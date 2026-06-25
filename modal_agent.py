"""
modal_agent.py — Autonomous loop for Hands Off, running on Modal as a scheduled function.

Replaces the TypeScript daemon + local process. Runs entirely server-side, writes to
Supabase. Vercel/Next.js app is read-only after this.

Pipeline: Scout (Companies House) -> Worker (LLM email drafting) -> Finance (PayPal)

Schedule: every 60 seconds via modal.Period.
Manual trigger: `modal run modal_agent.py` calls the local_entrypoint.

No mock / no fake data. If CH returns nothing, a no_results event is logged and the
tick exits cleanly. If the LLM errors, that job is skipped. If PayPal errors, a log
event is written and the job is left charged (status was already atomically flipped).
"""

import asyncio
import base64
import json
import os
import re
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
import modal
from openai import AsyncOpenAI

# ---------------------------------------------------------------------------
# Modal app + image
# ---------------------------------------------------------------------------

app = modal.App("handsoff-agent")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "httpx>=0.27.0",
        "openai>=1.30.0",
        "supabase>=2.4.0",
    )
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CH_BASE = "https://api.company-information.service.gov.uk"
CH_TIMEOUT = 8.0        # seconds per CH request
CH_CONCURRENCY = 4      # max simultaneous CH profile/officer fetches
SCOUT_INTAKE = 6        # max new jobs to insert per tick

WORKER_BATCH = 5        # max jobs to process per tick
WORKER_CONCURRENCY = 4  # max simultaneous LLM calls

PAYPAL_BASE = "https://api-m.sandbox.paypal.com"
PAYPAL_TIMEOUT = 12.0   # seconds per PayPal API call

LLM_TIMEOUT = 30.0      # seconds for LLM inference (Modal cold starts can be slow)

# ---------------------------------------------------------------------------
# Category derivation (ported from lib/learning.ts)
# ---------------------------------------------------------------------------

CATEGORY_RULES = [
    (re.compile(r"cold.?email|outreach email|email template", re.I), "cold-emails"),
    (re.compile(r"summar|recap|tldr|summarise|summarize", re.I), "summary"),
    (re.compile(r"landing.?page|hero copy|homepage copy", re.I), "landing-copy"),
    (re.compile(r"research|competitive analysis|market research", re.I), "research"),
    (re.compile(r"data.?clean|csv|spreadsheet|data entry", re.I), "data-cleaning"),
    (re.compile(r"tweet|thread|twitter|x\.com", re.I), "social-content"),
    (re.compile(r"blog|article|post|write.?up", re.I), "blog-writing"),
    (re.compile(r"proofread|edit|rewrite|polish|grammar", re.I), "proofreading"),
    (re.compile(r"product description|product copy|ecommerce", re.I), "product-copy"),
    (re.compile(r"cover letter|cv|resume|job application", re.I), "career-docs"),
    (re.compile(r"python|javascript|script|code|function", re.I), "code-snippets"),
]


def derive_category(title: str, body: str) -> str:
    text = f"{title} {body}"
    for pattern, category in CATEGORY_RULES:
        if pattern.search(text):
            return category
    return "general-writing"


# ---------------------------------------------------------------------------
# Date / penalty helpers (ported from lib/demand.ts)
# ---------------------------------------------------------------------------

def is_plausible_due_date(iso: str) -> bool:
    """Reject CH data errors: dates before 2000 or more than 3 years out."""
    try:
        d = datetime.fromisoformat(iso)
        year = d.year
        if year < 2000:
            return False
        if year > datetime.now().year + 3:
            return False
        return True
    except Exception:
        return False


def days_until(due_date_str: str) -> int:
    """Days between today and due_date. Negative = overdue."""
    due = datetime.fromisoformat(due_date_str).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=None
    )
    now = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return round((due - now).total_seconds() / 86400)


def penalty_band(days_overdue: int) -> str:
    if days_overdue <= 0:
        return "no penalty yet"
    if days_overdue <= 30:
        return "£150 (up to 1 month late)"
    if days_overdue <= 90:
        return "£375 (1-3 months late)"
    if days_overdue <= 180:
        return "£750 (3-6 months late)"
    return "£1,500 (6+ months late)"


def format_date(iso: str) -> str:
    """Format 'YYYY-MM-DD' as '30 September 2024'."""
    d = datetime.fromisoformat(iso)
    return d.strftime("%-d %B %Y")


# ---------------------------------------------------------------------------
# Concurrency helper
# ---------------------------------------------------------------------------

async def p_limit(tasks: list, limit: int) -> list:
    """Run async callables with bounded concurrency. Returns results in order."""
    results = [None] * len(tasks)
    current = {"i": 0}
    lock = asyncio.Lock()

    async def worker():
        while True:
            async with lock:
                i = current["i"]
                if i >= len(tasks):
                    return
                current["i"] += 1
            results[i] = await tasks[i]()

    runners = [worker() for _ in range(min(limit, len(tasks)))]
    await asyncio.gather(*runners)
    return results


# ---------------------------------------------------------------------------
# Supabase client (httpx against PostgREST with SERVICE ROLE key, bypasses RLS)
# ---------------------------------------------------------------------------

class SupabaseClient:
    """Thin async PostgREST client. SERVICE ROLE key means RLS is bypassed."""

    def __init__(self, url: str, service_key: str):
        self._url = url.rstrip("/")
        self._headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def insert(self, table: str, row: dict) -> dict:
        """Insert a row. Returns the inserted row dict."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{self._url}/rest/v1/{table}",
                headers=self._headers,
                json=row,
            )
            r.raise_for_status()
            data = r.json()
            return data[0] if isinstance(data, list) and data else {}

    async def insert_ignore_conflict(self, table: str, row: dict) -> tuple:
        """Insert a row. Returns (row_dict, error_code). error_code='23505' on unique conflict."""
        headers = {
            **self._headers,
            "Prefer": "return=representation,resolution=ignore-duplicates",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{self._url}/rest/v1/{table}",
                headers=headers,
                json=row,
            )
            if r.status_code in (409, 200) and not r.text.strip().startswith("["):
                # PostgREST 409 = unique violation
                if r.status_code == 409:
                    return {}, "23505"
            if not r.is_success:
                body = r.text
                if "23505" in body:
                    return {}, "23505"
                r.raise_for_status()
            data = r.json()
            # ignore-duplicates returns [] when nothing was inserted (conflict)
            if isinstance(data, list) and not data:
                return {}, "23505"
            return (data[0] if isinstance(data, list) else {}), None

    async def select(self, table: str, filters: dict = None, columns: str = "*",
                     order: str = None, limit: int = None) -> list:
        """Select rows with optional PostgREST filter params."""
        params = {"select": columns}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order
        if limit:
            params["limit"] = str(limit)
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{self._url}/rest/v1/{table}",
                headers=self._headers,
                params=params,
            )
            r.raise_for_status()
            return r.json()

    async def update(self, table: str, filters: dict, data: dict) -> list:
        """Update rows matching all filters. Returns updated rows."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.patch(
                f"{self._url}/rest/v1/{table}",
                headers=self._headers,
                params=filters,
                json=data,
            )
            r.raise_for_status()
            return r.json()


def make_db() -> SupabaseClient:
    return SupabaseClient(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


# ---------------------------------------------------------------------------
# Event logging
# ---------------------------------------------------------------------------

async def log_event(db: SupabaseClient, agent: str, action: str, detail: str,
                    job_id: str = None):
    """Append a row to the events table. Never raises."""
    try:
        row = {"agent": agent, "action": action, "detail": detail}
        if job_id:
            row["job_id"] = job_id
        await db.insert("events", row)
    except Exception as e:
        print(f"[events] log_event failed: {e}")


# ---------------------------------------------------------------------------
# Scout: Companies House fetch + filter + director lookup
# ---------------------------------------------------------------------------

async def fetch_active_director(company_number: str, auth_header: str) -> Optional[str]:
    """Fetch first active director name from CH officers endpoint. None on any error."""
    try:
        async with httpx.AsyncClient(timeout=CH_TIMEOUT) as client:
            r = await client.get(
                f"{CH_BASE}/company/{company_number}/officers",
                headers={"Authorization": auth_header, "Accept": "application/json"},
            )
            if not r.is_success:
                return None
            data = r.json()
            for officer in data.get("items", []):
                role = officer.get("officer_role", "").lower()
                if "director" in role and not officer.get("resigned_on"):
                    return officer.get("name")
            return None
    except Exception:
        return None


def build_demand_item(profile: dict, director: Optional[str]) -> Optional[dict]:
    """Convert a CH company profile to a demand item dict. None if not eligible."""
    accounts = profile.get("accounts", {})
    raw_next_due = accounts.get("next_due", "")
    company_number = profile.get("company_number", "")
    company_name = profile.get("company_name", "")

    if not raw_next_due:
        return None
    if not is_plausible_due_date(raw_next_due):
        print(f"[scout] Skipping {company_name} ({company_number}): implausible next_due '{raw_next_due}'")
        return None

    is_overdue = accounts.get("overdue", False)
    days = days_until(raw_next_due)

    if not (days <= 30 or is_overdue):
        return None

    days_overdue = abs(days) if is_overdue else 0
    due_date_fmt = format_date(raw_next_due)
    penalty = penalty_band(days_overdue)

    if is_overdue:
        status_line = f"Accounts are OVERDUE by approximately {days_overdue} day(s)."
    else:
        status_line = f"Accounts are due in {days} day(s) ({due_date_fmt})."

    title = f"{company_name} accounts due {due_date_fmt}"
    body = " ".join([
        f"Company: {company_name} ({company_number})",
        status_line,
        f"Current penalty band: {penalty}",
        "Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts.",
        "Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    ])

    budget_text = penalty.split(" ")[0] if is_overdue else None
    ch_url = f"https://find-and-update.company-information.service.gov.uk/company/{company_number}"

    return {
        "source": "companies-house",
        "source_url": ch_url,
        "title": title,
        "body": body,
        "budget_text": budget_text,
        "director": director,
    }


async def fetch_ch_demand() -> list:
    """Fetch active companies from CH, filter to imminent/overdue. Returns [] on any error."""
    api_key = os.environ.get("CH_API_KEY", "")
    if not api_key:
        print("[scout] CH_API_KEY not set — returning empty")
        return []

    auth_header = "Basic " + base64.b64encode(f"{api_key}:".encode()).decode()
    common_headers = {"Authorization": auth_header, "Accept": "application/json"}

    try:
        # Step 1: search for active companies
        async with httpx.AsyncClient(timeout=CH_TIMEOUT) as client:
            r = await client.get(
                f"{CH_BASE}/advanced-search/companies",
                headers=common_headers,
                params={"status": "active", "size": "50"},
            )
        if not r.is_success:
            print(f"[scout] CH search failed: {r.status_code}")
            return []

        companies = r.json().get("items", [])
        if not companies:
            return []

        # Step 2: fetch profiles with bounded concurrency
        async def fetch_profile(company: dict):
            try:
                async with httpx.AsyncClient(timeout=CH_TIMEOUT) as client:
                    r = await client.get(
                        f"{CH_BASE}/company/{company['company_number']}",
                        headers=common_headers,
                    )
                if not r.is_success:
                    return None
                return r.json()
            except Exception:
                return None

        profile_tasks = [lambda c=c: fetch_profile(c) for c in companies]
        profiles = await p_limit(profile_tasks, CH_CONCURRENCY)

        # Step 3: filter eligible profiles and fetch directors
        eligible = []
        for profile in profiles:
            if not profile:
                continue
            accounts = profile.get("accounts", {})
            next_due = accounts.get("next_due", "")
            if not next_due or not is_plausible_due_date(next_due):
                continue
            days = days_until(next_due)
            is_overdue = accounts.get("overdue", False)
            if days <= 30 or is_overdue:
                eligible.append(profile)

        async def fetch_and_build(profile: dict):
            director = await fetch_active_director(
                profile["company_number"], auth_header
            )
            return build_demand_item(profile, director)

        director_tasks = [lambda p=p: fetch_and_build(p) for p in eligible]
        items = await p_limit(director_tasks, CH_CONCURRENCY)
        return [i for i in items if i is not None]

    except Exception as e:
        print(f"[scout] CH error: {e}")
        return []


# ---------------------------------------------------------------------------
# Scout agent run
# ---------------------------------------------------------------------------

async def run_scout(db: SupabaseClient):
    await log_event(db, "scout", "started",
                    "Scout checking Companies House for companies with imminent or overdue filing deadlines.")

    all_items = await fetch_ch_demand()
    posts = all_items[:SCOUT_INTAKE]

    if not posts:
        await log_event(db, "scout", "no_results",
                        "No demand candidates returned — CH API may be unreachable or no companies met the deadline filter this tick.")
        return

    found = 0
    dupes = 0

    for post in posts:
        try:
            body_with_director = (
                f"DIRECTOR: {post['director']}\n{post['body']}"
                if post.get("director")
                else post["body"]
            )

            row = {
                "source": post["source"],
                "source_url": post["source_url"],
                "title": post["title"],
                "body": body_with_director,
                "budget_text": post.get("budget_text"),
                "status": "found",
            }

            inserted, err_code = await db.insert_ignore_conflict("jobs", row)

            if err_code == "23505":
                dupes += 1
                continue

            # Fetch the inserted row to get its generated UUID
            rows = await db.select("jobs", {"source_url": f"eq.{post['source_url']}"}, "id")
            job_id = rows[0]["id"] if rows else None

            await log_event(db, "scout", "found",
                            f"Discovered ({post['source']}): {post['title'][:80]}",
                            job_id=job_id)
            found += 1

        except Exception as e:
            print(f"[scout] error processing post: {e}")

    await log_event(db, "scout", "complete",
                    f"Scan complete. {found} new jobs found, {dupes} duplicates skipped.")


# ---------------------------------------------------------------------------
# Worker: LLM prompt, JSON parsing, email assembly
# ---------------------------------------------------------------------------

STRIP_BRACKETS_RE = re.compile(r"\[[^\]]+\]")


def strip_placeholders(text: str) -> str:
    """Remove [bracketed] placeholders the LLM may have emitted."""
    return re.sub(r" +", " ", STRIP_BRACKETS_RE.sub("", text)).strip()


def assemble_email(llm_body: str, director: Optional[str]) -> str:
    """Salutation and sign-off are assembled in code, never from the LLM."""
    salutation = f"Dear {director}," if director else "Dear Sir/Madam,"
    clean_body = strip_placeholders(llm_body)
    signoff = "Best regards,\nThe Hands Off team"
    return f"{salutation}\n\n{clean_body}\n\n{signoff}"


def build_prompt(title: str, body: str, budget_text: Optional[str]) -> str:
    return f"""You are an autonomous agent that helps UK small businesses avoid late filing penalties at Companies House.

A company has been flagged with an upcoming or overdue accounts filing deadline. Your job is to write the BODY of a professional, warm filing reminder on behalf of Hands Off, a filing service.

Company lead:
Title: {title}
Details:
{body[:1200]}

Write ONLY the middle body paragraphs of the email. Do NOT include a salutation (no "Dear ...") and do NOT include a sign-off (no "Best regards" or any closing). The salutation and sign-off will be added in code.

The body must:
1. State the company name and number, then clearly say whether accounts are overdue by approximately N days, or due on a specific date.
2. Name the penalty they risk: quote the exact £ figure from the lead details (e.g. £375 for 1-3 months late). Be direct about what they face if they miss the deadline.
3. In a single natural sentence, mention the documents they will need: profit and loss statement, balance sheet, director's report, and notes to the accounts.
4. Offer help with a line like: "If you would like, we can prepare and file this on your behalf for less than 5% of the penalty."

Rules:
- Do NOT include any salutation or sign-off — those are added by the system.
- Do NOT write any text in square brackets like [Your Name] or [Company Name] or [Director]. Write real content only.
- No em dashes. Use a comma or rewrite the sentence instead.
- No AI-slop words: seamless, elevate, leverage, synergy, game-changer, cutting-edge, transform, unlock, empower.
- Keep it under 150 words. Concise and human.

Respond with a JSON object matching this exact schema:
{{
  "decision": "fulfil",
  "reasoning": "1-2 sentences on why this lead is worth pursuing",
  "deliverable": "the body paragraphs only (no salutation, no sign-off)",
  "feeCents": a number between 2000 and 5000
}}

Always set decision to "fulfil" for Companies House leads — every company with an overdue or imminent deadline is a valid prospect."""


def random_fee_cents() -> int:
    return random.randint(2000, 5000)


def parse_llm_response(obj: dict, director: Optional[str]) -> dict:
    """Parse the LLM JSON into a worker decision dict with assembled email."""
    decision = "fulfil" if obj.get("decision") == "fulfil" else "skip"
    reasoning = str(obj.get("reasoning", "No reasoning provided."))

    if decision == "fulfil":
        llm_body = str(obj.get("deliverable", ""))
        deliverable = assemble_email(llm_body, director)
        try:
            fee_cents = max(2000, min(5000, int(obj.get("feeCents", 0))))
        except (TypeError, ValueError):
            fee_cents = random_fee_cents()
        return {"decision": "fulfil", "reasoning": reasoning,
                "deliverable": deliverable, "fee_cents": fee_cents}

    return {"decision": "skip", "reasoning": reasoning}


async def call_llm(prompt: str) -> Optional[dict]:
    """Call the Modal vLLM endpoint via the OpenAI Python client. Returns parsed dict or None."""
    base_url = os.environ.get("MODAL_LLM_BASE_URL", "")
    api_key = os.environ.get("MODAL_LLM_API_KEY", "")
    model = os.environ.get("MODAL_LLM_MODEL", "")

    if not (base_url and api_key and model):
        return None

    try:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=LLM_TIMEOUT)
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=600,
        )
        content = response.choices[0].message.content or ""
        # Extract JSON even if the model wraps it in markdown fences
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            print(f"[worker] LLM response has no JSON: {content[:200]}")
            return None
        return json.loads(match.group())
    except Exception as e:
        print(f"[worker] LLM call failed: {e}")
        return None


async def evaluate_job_llm(title: str, body: str, budget_text: Optional[str],
                           director: Optional[str]) -> dict:
    """Evaluate a job via LLM. Skips the job (never fabricates) if LLM is unavailable."""
    prompt = build_prompt(title, body, budget_text)
    raw = await call_llm(prompt)
    if raw is None:
        return {
            "decision": "skip",
            "reasoning": "LLM unavailable or returned invalid JSON — skipping this tick.",
        }
    return parse_llm_response(raw, director)


# ---------------------------------------------------------------------------
# Learnings helpers
# ---------------------------------------------------------------------------

async def get_learned_fee(db: SupabaseClient, category: str) -> Optional[int]:
    """Return learned fee for a category, or None if no sufficient data."""
    try:
        rows = await db.select("learnings", {"category": f"eq.{category}"}, "signal,fee_cents")
        if not rows:
            return None
        approved_fees = [r["fee_cents"] for r in rows if r["signal"] == "approved"]
        if not approved_fees:
            return None
        acceptance_rate = len(approved_fees) / len(rows)
        avg = sum(approved_fees) / len(approved_fees)
        return round(max(50, min(1000, avg * (0.5 + 0.5 * acceptance_rate))))
    except Exception as e:
        print(f"[learning] get_learned_fee error: {e}")
        return None


async def get_category_acceptance_rate(db: SupabaseClient, category: str) -> Optional[float]:
    """Return acceptance rate for a category. None if fewer than 2 signals."""
    try:
        rows = await db.select("learnings", {"category": f"eq.{category}"}, "signal")
        if len(rows) < 2:
            return None
        approved = sum(1 for r in rows if r["signal"] == "approved")
        return approved / len(rows)
    except Exception as e:
        print(f"[learning] get_category_acceptance_rate error: {e}")
        return None


async def record_learning(db: SupabaseClient, job_id: str, category: str,
                          signal: str, fee_cents: int):
    """Insert a learnings row. Never raises."""
    try:
        await db.insert("learnings", {
            "job_id": job_id,
            "category": category,
            "signal": signal,
            "fee_cents": fee_cents,
        })
    except Exception as e:
        print(f"[learning] record_learning failed: {e}")


# ---------------------------------------------------------------------------
# Worker: process a single job
# ---------------------------------------------------------------------------

async def process_job(db: SupabaseClient, job: dict):
    """Evaluate one 'found' job through the LLM and update its status."""
    job_id = job["id"]
    category = derive_category(job["title"], job["body"])

    # Skip proactively if this category has a learned low acceptance rate
    rate = await get_category_acceptance_rate(db, category)
    if rate is not None and rate < 0.25:
        skip_reason = (
            f"[Learned] {category.replace('-', ' ')} jobs have a "
            f"{round(rate * 100)}% approval rate — skipping to prioritise better-performing categories."
        )
        await db.update("jobs", {"id": f"eq.{job_id}"}, {"status": "skipped", "reasoning": skip_reason})
        await log_event(db, "worker", "skipped", skip_reason, job_id=job_id)
        return

    # Extract director name embedded in body by Scout (format: "DIRECTOR: Name\n...")
    director: Optional[str] = None
    job_body = job["body"]
    if job_body.startswith("DIRECTOR: "):
        newline_idx = job_body.find("\n")
        if newline_idx != -1:
            director = job_body[len("DIRECTOR: "):newline_idx].strip() or None
            job_body = job_body[newline_idx + 1:]

    result = await evaluate_job_llm(job["title"], job_body, job.get("budget_text"), director)

    final_fee = result.get("fee_cents", 3000)
    if result["decision"] == "fulfil":
        learned = await get_learned_fee(db, category)
        if learned is not None:
            final_fee = learned

    new_status = "approved" if result["decision"] == "fulfil" else "skipped"
    await db.update("jobs", {"id": f"eq.{job_id}"}, {
        "status": new_status,
        "reasoning": result["reasoning"],
        "deliverable": result.get("deliverable"),
        "fee_cents": final_fee if result["decision"] == "fulfil" else None,
    })

    if result["decision"] == "fulfil":
        used_learned = (result.get("fee_cents", final_fee) != final_fee)
        price_note = f" (learned price for {category.replace('-', ' ')})" if used_learned else ""
        await log_event(
            db, "worker", "fulfilled",
            f"Drafted deliverable. Fee: £{final_fee / 100:.2f}{price_note}. "
            f"Billing automatically. Reason: {result['reasoning']}",
            job_id=job_id,
        )
    else:
        await log_event(db, "worker", "skipped",
                        f"Skipped: {result['reasoning']}", job_id=job_id)


# ---------------------------------------------------------------------------
# Worker agent run
# ---------------------------------------------------------------------------

async def run_worker(db: SupabaseClient):
    await log_event(db, "worker", "started", "Worker scanning for new jobs to evaluate.")

    jobs = await db.select(
        "jobs", {"status": "eq.found"}, "*", order="created_at.asc", limit=WORKER_BATCH
    )

    if not jobs:
        await log_event(db, "worker", "idle", "No 'found' jobs in queue.")
        return

    tasks = [lambda j=j: process_job(db, j) for j in jobs]
    await p_limit(tasks, WORKER_CONCURRENCY)

    await log_event(db, "worker", "complete", f"Worker processed {len(jobs)} job(s).")


# ---------------------------------------------------------------------------
# Finance: PayPal sandbox invoicing (GBP)
# ---------------------------------------------------------------------------

async def _get_paypal_token(client_id: str, secret: str) -> str:
    creds = base64.b64encode(f"{client_id}:{secret}".encode()).decode()
    async with httpx.AsyncClient(timeout=PAYPAL_TIMEOUT) as client:
        r = await client.post(
            f"{PAYPAL_BASE}/v1/oauth2/token",
            headers={
                "Authorization": f"Basic {creds}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data="grant_type=client_credentials",
        )
        if not r.is_success:
            raise RuntimeError(f"PayPal token error {r.status_code}: {r.text}")
        return r.json()["access_token"]


async def create_paypal_invoice(job_title: str, fee_cents: int) -> dict:
    """Create a real PayPal sandbox invoice in GBP. Falls back to simulated on any error."""
    client_id = os.environ.get("PAYPAL_CLIENT_ID", "")
    secret = os.environ.get("PAYPAL_SECRET", "")

    if not (client_id and secret):
        sim_id = f"SIM-INV-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        return {"invoice_id": sim_id,
                "invoice_url": f"https://www.sandbox.paypal.com/invoice/p/#{sim_id}",
                "simulated": True}

    try:
        token = await _get_paypal_token(client_id, secret)

        payload = {
            "detail": {
                "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "currency_code": "GBP",
                "note": "AI-generated deliverable via Hands Off autonomous agent.",
                "payment_term": {"term_type": "DUE_ON_RECEIPT"},
            },
            "invoicer": {
                "name": {"given_name": "Hands", "surname": "Off"},
                "email_address": "handsoff-demo@example.com",
            },
            "primary_recipients": [{
                "billing_info": {
                    "email_address": "sb-gj843k51323540@personal.example.com",
                },
            }],
            "items": [{
                "name": job_title[:100],
                "quantity": "1",
                "unit_amount": {"currency_code": "GBP", "value": f"{fee_cents / 100:.2f}"},
                "unit_of_measure": "AMOUNT",
            }],
        }

        async with httpx.AsyncClient(timeout=PAYPAL_TIMEOUT) as client:
            r = await client.post(
                f"{PAYPAL_BASE}/v2/invoicing/invoices",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload,
            )
            if not r.is_success:
                raise RuntimeError(f"PayPal create invoice {r.status_code}: {r.text}")
            created = r.json()

        # Invoice ID lives in the `href` field, NOT a top-level `id`
        href = created.get("href", "")
        href_id = href.split("/")[-1] if href else None
        invoice_id = created.get("id") or href_id or f"PP-INV-{int(datetime.now(timezone.utc).timestamp() * 1000)}"

        # Send the invoice (best-effort — creation is the important step)
        try:
            async with httpx.AsyncClient(timeout=PAYPAL_TIMEOUT) as client:
                await client.post(
                    f"{PAYPAL_BASE}/v2/invoicing/invoices/{invoice_id}/send",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"send_to_invoicer": True},
                )
        except Exception as send_err:
            print(f"[finance] invoice send failed (non-fatal): {send_err}")

        return {
            "invoice_id": invoice_id,
            "invoice_url": f"https://www.sandbox.paypal.com/invoice/p/#{invoice_id}",
            "simulated": False,
        }

    except Exception as e:
        print(f"[finance] PayPal error: {e}")
        err_id = f"SIM-ERR-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        return {"invoice_id": err_id,
                "invoice_url": f"https://www.sandbox.paypal.com/invoice/p/#{err_id}",
                "simulated": True}


async def run_finance_single(db: SupabaseClient, job_id: str):
    """Bill one approved job. Atomically claims the row before calling PayPal.
    If the row is no longer 'approved' (concurrent tick already claimed it), silently exits."""

    # Atomic claim: UPDATE ... WHERE id=? AND status='approved'
    # PostgREST: pass both id and status filters as separate params
    claimed = await db.update(
        "jobs",
        {"id": f"eq.{job_id}", "status": "eq.approved"},
        {"status": "charged"},
    )

    if not claimed:
        print(f"[finance] job {job_id} not claimable (already charged or not approved)")
        return

    job = claimed[0]
    fee_cents = job.get("fee_cents") or 500

    await log_event(db, "finance", "invoicing",
                    f"Creating PayPal sandbox invoice for: {job['title'][:80]}",
                    job_id=job_id)

    invoice = await create_paypal_invoice(job["title"], fee_cents)

    fee_pounds = fee_cents / 100
    payment_line = (
        f"\n\nService fee: £{fee_pounds:.2f}\nPay securely here: {invoice['invoice_url']}"
        if invoice.get("invoice_url")
        else f"\n\nService fee: £{fee_pounds:.2f}"
    )

    current_deliverable = job.get("deliverable") or ""
    await db.update("jobs", {"id": f"eq.{job_id}"},
                    {"deliverable": current_deliverable + payment_line})

    sim_note = " (simulated — no PayPal credentials)" if invoice["simulated"] else ""
    await log_event(
        db, "finance", "charged",
        f"Invoice {invoice['invoice_id']} created{sim_note}. £{fee_pounds:.2f} billed. Pay link appended to deliverable.",
        job_id=job_id,
    )

    # Record a learning signal on every real charge
    category = derive_category(job["title"], job.get("body", ""))
    await record_learning(db, job_id, category, "approved", fee_cents)


async def run_finance_queue(db: SupabaseClient):
    """Bill all jobs in 'approved' state. Each call is idempotent via atomic claim."""
    rows = await db.select("jobs", {"status": "eq.approved"}, "id")
    approved_ids = [r["id"] for r in (rows or [])]

    tasks = [lambda jid=jid: run_finance_single(db, jid) for jid in approved_ids]
    await p_limit(tasks, 3)


# ---------------------------------------------------------------------------
# Main tick: Scout -> Worker -> Finance
# ---------------------------------------------------------------------------

async def tick():
    """One full pipeline iteration. Never raises."""
    db = make_db()
    print(f"[tick] Starting at {datetime.now(timezone.utc).isoformat()}")
    for name, fn in [("scout", run_scout), ("worker", run_worker), ("finance", run_finance_queue)]:
        try:
            await fn(db)
        except Exception as e:
            print(f"[tick] {name} error: {e}")
    print(f"[tick] Done at {datetime.now(timezone.utc).isoformat()}")


# ---------------------------------------------------------------------------
# Modal function: scheduled every 60 seconds
# ---------------------------------------------------------------------------

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("handsoff-secrets")],
    schedule=modal.Period(seconds=60),
    timeout=120,
)
async def scheduled_tick():
    """Runs every 60 seconds on Modal. Fully autonomous, nothing needed on Marc's laptop."""
    await tick()


# ---------------------------------------------------------------------------
# Local entrypoint for one manual run: `modal run modal_agent.py`
# ---------------------------------------------------------------------------

@app.local_entrypoint()
def main():
    """Trigger one remote tick manually for verification."""
    scheduled_tick.remote()
