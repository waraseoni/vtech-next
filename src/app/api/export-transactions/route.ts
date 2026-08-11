import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_MAP: Record<number, string> = {
  0: "Pending", 1: "On-Progress", 2: "Done",
  3: "Paid", 4: "Cancelled", 5: "Delivered",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(iso));
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

// Escape cell value for CSV
function csv(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  // Wrap in quotes if contains comma, quote, or newline
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url      = new URL(req.url);
  const dateFrom = url.searchParams.get("date_from") || "";
  const dateTo   = url.searchParams.get("date_to")   || "";
  const format   = url.searchParams.get("format") || "excel"; // excel | csv

  // ── Fetch transactions ─────────────────────────────────────────────────────
  let q = supabase
    .from("transaction_list")
    .select("*")
    .eq("del_status", 0)
    .order("date_created", { ascending: false });

  if (dateFrom) q = q.gte("date_created", `${dateFrom}T00:00:00+05:30`);
  if (dateTo)   q = q.lte("date_created", `${dateTo}T23:59:59+05:30`);

  let txns = [];
  try {
    txns = await fetchAll(q);
  } catch {
    return new NextResponse("Koi data nahi mila", { status: 404 });
  }
  if (!txns?.length) {
    return new NextResponse("Koi data nahi mila", { status: 404 });
  }

  // ── Fetch client names ─────────────────────────────────────────────────────
  const clientIds = [...new Set(txns.map(t => Number(t.client_name)))];
  const clients = await fetchAllIn(
    (ids) => supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact, address")
      .in("id", ids),
    clientIds
  );
  const clientMap = new Map(clients?.map(c => [c.id, c]) ?? []);

  // ── Fetch mechanic names ───────────────────────────────────────────────────
  const mechIds = [...new Set(txns.map(t => t.mechanic_id).filter(Boolean))];
  const mechMap = new Map<number, string>();
  if (mechIds.length > 0) {
    const mechs = await fetchAllIn(
      (ids) => supabase
        .from("mechanic_list")
        .select("id, firstname, lastname")
        .in("id", ids),
      mechIds
    );
    mechs?.forEach(m => mechMap.set(m.id, `${m.firstname} ${m.lastname}`.trim()));
  }

  const dateLabel = dateFrom && dateTo
    ? (dateFrom === dateTo ? dateFrom : `${dateFrom}_to_${dateTo}`)
    : "all";
  const filename = `transactions_${dateLabel}`;

  // ══════════════════════════════════════════════════════════════════════════
  // EXCEL (XLS via HTML table — opens directly in Excel)
  // ══════════════════════════════════════════════════════════════════════════
  if (format !== "csv") {
    const xls = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>V-Technologies Transactions</Title>
    <Author>V-Tech System</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>
      <Interior ss:Color="#001F3F" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
    <Style ss:ID="total">
      <Font ss:Bold="1" ss:Size="12"/>
      <Interior ss:Color="#FFF9C4" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Transactions">
    <Table>
      <Row>
        <Cell ss:MergeAcross="14" ss:StyleID="header">
          <Data ss:Type="String">V-TECHNOLOGIES — Transactions Report (${dateLabel === "all" ? "All Records" : dateLabel.replace("_to_", " to ")})</Data>
        </Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="header"><Data ss:Type="String">#</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Date &amp; Time</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Job ID</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Code</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Client Name</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Contact</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Address</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Item / Model</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Fault</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Location</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Remark</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Mechanic</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Amount (Rs.)</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Status</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Delivered On</Data></Cell>
      </Row>
      ${txns.map((t, i) => {
        const cid    = Number(t.client_name);
        const client = clientMap.get(cid);
        const cName  = client
          ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
          : `Client #${cid}`;
        const mName  = t.mechanic_id ? (mechMap.get(t.mechanic_id) || "") : "";
        const esc    = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<Row>
          <Cell><Data ss:Type="Number">${i + 1}</Data></Cell>
          <Cell><Data ss:Type="String">${fmtDateTime(t.date_created)}</Data></Cell>
          <Cell><Data ss:Type="String">${t.job_id}</Data></Cell>
          <Cell><Data ss:Type="String">${t.code || ""}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(cName)}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(client?.contact || "")}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(client?.address || "")}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(t.item || "")}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(t.fault || "")}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(t.uniq_id || "")}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(t.remark || "")}</Data></Cell>
          <Cell><Data ss:Type="String">${esc(mName)}</Data></Cell>
          <Cell><Data ss:Type="Number">${(t.amount || 0).toFixed(2)}</Data></Cell>
          <Cell><Data ss:Type="String">${STATUS_MAP[t.status] || ""}</Data></Cell>
          <Cell><Data ss:Type="String">${fmtDate(t.date_completed)}</Data></Cell>
        </Row>`;
      }).join("")}
      <Row>
        <Cell ss:MergeAcross="11" ss:StyleID="total">
          <Data ss:Type="String">TOTAL (${txns.length} records)</Data>
        </Cell>
        <Cell ss:StyleID="total">
          <Data ss:Type="Number">${txns.reduce((s, t) => s + (t.amount || 0), 0).toFixed(2)}</Data>
        </Cell>
        <Cell/><Cell/>
      </Row>
    </Table>
  </Worksheet>
</Workbook>`;

    return new NextResponse(xls, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.xls"`,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CSV fallback (?format=csv)
  // ══════════════════════════════════════════════════════════════════════════
  const header = [
    "#","Date","Time","Job ID","Code","Client Name","Contact","Address",
    "Item","Fault","Location","Remark","Mechanic","Amount","Status","Delivered On",
  ].map(csv).join(",");

  const dataRows = txns.map((t, i) => {
    const cid    = Number(t.client_name);
    const client = clientMap.get(cid);
    const cName  = client
      ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
      : `Client #${cid}`;
    const mName  = t.mechanic_id ? (mechMap.get(t.mechanic_id) || "") : "";
    const d      = new Date(t.date_created);
    return [
      i + 1,
      fmtDate(t.date_created),
      new Intl.DateTimeFormat("en-IN", { timeZone:"Asia/Kolkata", hour:"2-digit", minute:"2-digit", hour12:false }).format(d),
      `#${t.job_id}`, t.code || "", cName,
      client?.contact || "", client?.address || "",
      t.item || "", t.fault || "", t.uniq_id || "", t.remark || "",
      mName, (t.amount || 0).toFixed(2),
      STATUS_MAP[t.status] || "", fmtDate(t.date_completed),
    ].map(csv).join(",");
  });

  const csvContent = "\uFEFF" + [header, ...dataRows].join("\r\n"); // BOM for Excel UTF-8

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}