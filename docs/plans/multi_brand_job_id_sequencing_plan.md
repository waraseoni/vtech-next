# Multi-Brand Job ID Sequencing Architecture & Setup Guide

> **Current Decision (Nov 2026)**:
> - **Primary Chosen Approach**: **Vikalp B (Dual-Identity Architecture)**
> - **Fresh Install Capability**: Naye client ke deployment par initial Job ID counter set karne aur currently active counter ko inspect karne ka feature.
> - **Note on Other Options**: Niche diye gaye *Option 1, Option 2, Option 4* reference ke liye archived hain (inhe implement nahi karna hai, reference preserved).

---

## 1. Selected Master Architecture: Vikalp B (Dual-Identity Architecture) 🌟

### Concept & Why It Is Best:
1. **Global Master Sequence (`job_id`)**:
   - Database level par ek universal continuous number chalega (e.g., `28101`, `28102`...).
   - Isse search bar, barcode scanning, database primary/foreign keys aur API integration me zero conflict rahega.
2. **Brand-Specific Symmetrical Serial (`brand_job_no`)**:
   - Har brand ke andar ka alag symmetrical counter:
     - Komaki: `KMK#001`, `KMK#002`, `KMK#003`...
     - Ola: `OLA#001`, `OLA#002`, `OLA#003`...
     - Generic: `GEN#001`, `GEN#002`...
3. **Customer & Brand Presentation**:
   - Job Card, GST Invoice, Print Receipt aur WhatsApp SMS par:
     **`KMK#001 (Ref: 28101)`**
   - Brand Company ko warranty claims export karte waqt symmetrical `KMK#001` to `KMK#050` list milegi bina kisi missing number ke.

---

## 2. Fresh Installation & Job ID Configuration (New Requirement)

Jab aap kisi naye client ya nayi company ko fresh deployment dete hain, toh aksar unki pehle se koi physical book ya purana software chal raha hota hai (e.g. unka purana job number `1000` ya `5000` par khatam hua ho), ya fir wo `1001` se start karna chahte hain.

### A. Current Counter Inspection & Setting (UI Screen)
**Location**: `/settings` (Admin Settings) ya `/setup` (Fresh Installation Wizard) me ek dedicated **"Job Number Sequence Settings"** block:

#### UI Wireframe:
```
┌────────────────────────────────────────────────────────────────────────┐
│ 🔢 Job Sequence & Starting Number Settings                             │
├────────────────────────────────────────────────────────────────────────┤
│ Currently Configured Next Job ID: [ 28101 ]                            │
│ Total Jobs in Database: 0 (Fresh Installation)                         │
│                                                                        │
│ Starting Job Number: [ 1001       ]  [ 💾 Set Starting Number ]        │
│ ℹ️ Note: Naya number hamesha existing database ke highest job number  │
│    se bada hona chahiye taaki number duplicate na ho.                  │
│                                                                        │
│ 🏷️ Brand Initial Counter Matrix:                                       │
│  - Komaki (KMK): Next # [ 1001 ]                                       │
│  - Ola (OLA):    Next # [ 1001 ]                                       │
│  - Generic:      Next # [ 1001 ]                                       │
└────────────────────────────────────────────────────────────────────────┘
```

### B. Business Logic & Safety Rules (Expert Advice):
1. **Existing DB Inspection (Current Value Preview)**:
   - Screen open hote hi current `job_id_counter` ki value fetch karke dikhayega:
     `Current Next Job ID: X`
   - Agar DB me already jobs hain, toh `SELECT MAX(job_id) FROM transaction_list` calculate karke batayega ki *"Database me aakhiri job #28100 hai"*.
2. **Safety Floor Check (No Duplicate Numbers)**:
   - Admin agar galti se purane existing job se chhota number daalega (e.g. existing max `28100` hai aur admin `1000` daalna chahe), toh system warn aur block karega:
     > *"⚠️ Error: Database me pehle se #28100 tak jobs hain. Naya counter 28101 ya usse bada hona chahiye taaki overlap na ho."*
   - Lekin agar fresh installation hai (`transaction_list` empty hai), toh client chahe `1`, `101`, `1001`, ya `5001` kuch bhi initial number set kar sakta hai!
3. **Audit Log Entry**:
   - Jab bhi Admin starting counter change karega, `activity_logs` me audit record banega:
     `Admin changed Job ID starting sequence from 1001 to 5001`.

---

## 3. Database Implementation Blueprint

### Schema Updates:
```sql
-- 1. Brand counter table (per-brand symmetrical tokens)
CREATE TABLE IF NOT EXISTS public.brand_job_counters (
    brand_id integer PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
    last_sequence_number integer NOT NULL DEFAULT 0,
    prefix varchar(10) NOT NULL,
    date_updated timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add brand_job_no to transaction_list (additive, safe)
ALTER TABLE public.transaction_list
  ADD COLUMN IF NOT EXISTS brand_id integer REFERENCES public.brands(id),
  ADD COLUMN IF NOT EXISTS brand_job_no varchar(50) DEFAULT NULL;

-- 3. Atomic counter setter function (Safe for Admin UI)
CREATE OR REPLACE FUNCTION public.set_job_starting_counter(p_new_starting_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_existing integer;
BEGIN
    -- Check highest existing numeric job_id
    SELECT COALESCE(MAX(job_id::bigint), 0)
      INTO v_max_existing
      FROM public.transaction_list
     WHERE job_id ~ '^[0-9]+$';

    -- Guard: Duplicate prevention
    IF p_new_starting_id <= v_max_existing THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Naya starting number existing max (' || v_max_existing || ') se bada hona zaroori hai.'
        );
    END IF;

    -- Update or insert into job_id_counter (starting point is p_new_starting_id - 1)
    INSERT INTO public.job_id_counter (id, last_job_id)
    VALUES (1, p_new_starting_id - 1)
    ON CONFLICT (id)
    DO UPDATE SET last_job_id = p_new_starting_id - 1;

    RETURN jsonb_build_object(
        'success', true,
        'next_job_id', p_new_starting_id,
        'message', 'Job ID sequence successfully updated.'
    );
END;
$$;
```

---

## 4. Archive Section: Other Options (Reference Only — Do NOT Use)

> ⚠️ **ARCHIVE NOTE**: Niche diye gaye options par vichar kiya gaya tha par inhe use **nahi** karna hai. Final approved choice **Vikalp B** hai.

### [ARCHIVED] Option 1: Hybrid Prefixed Global Sequence
- Format: `KMK-28101`, `OLA-28102`
- Discard Reason: Ek hi sequence me prefix lagane se Brand ke serials me gaps aate hain (e.g. Komaki 1 ke baad seedha Komaki 5).

### [ARCHIVED] Option 2: Pure Isolated Brand Sequence
- Format: Sirf `KMK-1001` (bina kisi global job number ke).
- Discard Reason: Barcode scanning aur universal cross-brand search me universal flat identifier na hone se complexity badhti hai.

### [ARCHIVED] Option 4: Smart Year-Month Symmetrical Sequence
- Format: `2611-KMK-001`, `2611-KMK-002`
- Discard Reason: Month change par reset hone se clients ko numbering confuse lagti hai aur monthly coordination badh jata hai.
