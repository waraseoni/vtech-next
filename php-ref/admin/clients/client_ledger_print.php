<?php 
require_once('../../config.php'); 

if(!isset($_GET['id'])){
    echo "Invalid Client ID"; exit;
}

$id = $_GET['id'];
$from = isset($_GET['from']) && !empty($_GET['from']) ? $_GET['from'] : null;
$to = isset($_GET['to']) && !empty($_GET['to']) ? $_GET['to'] : null;

// Get multiple status filters as array
$status_filters = [];
if(isset($_GET['status']) && !empty($_GET['status'])) {
    if(is_array($_GET['status'])) {
        $status_filters = $_GET['status'];
    } else {
        $status_filters = explode(',', $_GET['status']);
    }
}

// Convert string values to proper types
$status_filters = array_map(function($item) {
    if(is_numeric($item)) {
        return (int)$item;
    }
    return $item;
}, $status_filters);

// === Status mapping with Colors ===
$status_arr = [
    0 => ['label' => "Pending", 'color' => '#f39c12', 'text' => '#fff'],
    1 => ['label' => "In Progress", 'color' => '#007bff', 'text' => '#fff'],
    2 => ['label' => "Done", 'color' => '#6f42c1', 'text' => '#fff'],
    3 => ['label' => "Paid", 'color' => '#28a745', 'text' => '#fff'],
    4 => ['label' => "Cancelled", 'color' => '#dc3545', 'text' => '#fff'],
    5 => ['label' => "Delivered", 'color' => '#19692c', 'text' => '#fff'],
    'payment' => ['label' => "Payments", 'color' => '#17a2b8', 'text' => '#fff'],
    'direct_sale' => ['label' => "Direct Sale", 'color' => '#ff6b6b', 'text' => '#fff'],
    // NEW: Loan disbursement status
    'loan' => ['label' => "Loan Disbursement", 'color' => '#9b59b6', 'text' => '#fff']
];

// 1. Fetch Client Details
$client_qry = $conn->query("SELECT *, CONCAT(firstname,' ',lastname) as name FROM `client_list` WHERE id = '{$id}'");
$client = ($client_qry->num_rows > 0) ? $client_qry->fetch_assoc() : die("Client not found");

// 2. Calculation of TOTAL BALANCE (Without any filter) - This is the actual current outstanding
$opening_bal = (float)$client['opening_balance'];

// Total repairs without any filter
$total_repairs_qry = $conn->query("SELECT SUM(amount) as total FROM transaction_list WHERE client_name = '{$id}'");
$total_repairs = (float)($total_repairs_qry->fetch_assoc()['total'] ?? 0);

// Total direct sales without any filter
$total_direct_sales_qry = $conn->query("SELECT SUM(total_amount) as total FROM direct_sales WHERE client_id = '{$id}'");
$total_direct_sales = (float)($total_direct_sales_qry->fetch_assoc()['total'] ?? 0);

// NEW: Total loans given (disbursed) without any filter
$total_loans_qry = $conn->query("SELECT SUM(total_payable) as total FROM client_loans WHERE client_id = '{$id}'");
$total_loans = (float)($total_loans_qry->fetch_assoc()['total'] ?? 0);

// Total payments without any filter (INCLUDING DISCOUNT) – this already includes loan repayments
$total_payments_qry = $conn->query("SELECT SUM(amount + discount) as total FROM client_payments WHERE client_id = '{$id}'");
$total_payments = (float)($total_payments_qry->fetch_assoc()['total'] ?? 0);

// Total discount without any filter
$total_discount_qry = $conn->query("SELECT SUM(discount) as total FROM client_payments WHERE client_id = '{$id}'");
$total_discount = (float)($total_discount_qry->fetch_assoc()['total'] ?? 0);

// CALCULATE ACTUAL CURRENT OUTSTANDING (Total Balance) – NOW INCLUDING LOANS
$current_outstanding = $opening_bal + $total_repairs + $total_direct_sales + $total_loans - $total_payments;

// Determine if client owes money or we owe money to client
$balance_type = '';
$balance_label = '';
$balance_color = '';

if ($current_outstanding > 0) {
    // Client owes money to us
    $balance_type = 'debit';
    $balance_label = 'AMOUNT RECEIVABLE FROM CLIENT';
    $balance_color = '#dc3545'; // Red
} elseif ($current_outstanding < 0) {
    // We owe money to client (negative balance means credit balance)
    $balance_type = 'credit';
    $balance_label = 'AMOUNT PAYABLE TO CLIENT';
    $balance_color = '#28a745'; // Green
    $current_outstanding = abs($current_outstanding); // Show as positive number for display
} else {
    // Zero balance
    $balance_type = 'zero';
    $balance_label = 'FULLY SETTLED';
    $balance_color = '#6c757d'; // Gray
}

// 3. Separate repair statuses, direct sales, payments, and loan filters
$repair_statuses = [];
$show_payments = false;
$show_direct_sales = false;
$show_loans = false; // NEW

foreach($status_filters as $filter) {
    if($filter === 'payment') {
        $show_payments = true;
    } elseif($filter === 'direct_sale') {
        $show_direct_sales = true;
    } elseif($filter === 'loan') { // NEW
        $show_loans = true;
    } elseif(is_numeric($filter)) {
        $repair_statuses[] = (int)$filter;
    }
}

// If no status filter selected, show all (including payments, direct sales, and loans)
if(empty($status_filters)) {
    $show_payments = true;
    $show_direct_sales = true;
    $show_loans = true; // NEW
    // Don't filter repairs by status - show all
    $repair_statuses = null;
}

// If only payment is selected, set repair_statuses to empty array and hide others
if(count($status_filters) == 1 && in_array('payment', $status_filters)) {
    $repair_statuses = [];
    $show_payments = true;
    $show_direct_sales = false;
    $show_loans = false;
}

// If only direct_sale is selected
if(count($status_filters) == 1 && in_array('direct_sale', $status_filters)) {
    $repair_statuses = [];
    $show_payments = false;
    $show_direct_sales = true;
    $show_loans = false;
}

// NEW: If only loan is selected
if(count($status_filters) == 1 && in_array('loan', $status_filters)) {
    $repair_statuses = [];
    $show_payments = false;
    $show_direct_sales = false;
    $show_loans = true;
}

// Previous repairs before date range (for filtered display)
$pre_repair_sql = "SELECT SUM(amount) as total FROM transaction_list WHERE client_name = '{$id}'";
if($repair_statuses !== null) {
    if(empty($repair_statuses)) {
        $pre_repair_sql .= " AND 1=0";
    } else {
        $pre_repair_sql .= " AND status IN (" . implode(',', $repair_statuses) . ")";
    }
}
$pre_repair_sql .= ($from ? " AND DATE(date_created) < '{$from}'" : " AND 1=0");
$pre_repairs = (float)($conn->query($pre_repair_sql)->fetch_assoc()['total'] ?? 0);

// Previous direct sales before date range
$pre_direct_sales_sql = "SELECT SUM(total_amount) as total FROM direct_sales WHERE client_id = '{$id}'";
$pre_direct_sales_sql .= ($from ? " AND DATE(date_created) < '{$from}'" : " AND 1=0");
$pre_direct_sales = (float)($conn->query($pre_direct_sales_sql)->fetch_assoc()['total'] ?? 0);

// NEW: Previous loans before date range
$pre_loans_sql = "SELECT SUM(total_payable) as total FROM client_loans WHERE client_id = '{$id}'";
$pre_loans_sql .= ($from ? " AND DATE(loan_date) < '{$from}'" : " AND 1=0");
$pre_loans = (float)($conn->query($pre_loans_sql)->fetch_assoc()['total'] ?? 0);

// Previous payments before date range (INCLUDING DISCOUNT) (for filtered display)
$pre_pay_sql = "SELECT SUM(amount + discount) as total FROM client_payments WHERE client_id = '{$id}'" . 
               ($from ? " AND DATE(payment_date) < '{$from}'" : " AND 1=0");
$pre_payments_filter = (float)($conn->query($pre_pay_sql)->fetch_assoc()['total'] ?? 0);

// Previous discount before date range (for filtered display)
$pre_discount_sql = "SELECT SUM(discount) as total FROM client_payments WHERE client_id = '{$id}'" . 
                    ($from ? " AND DATE(payment_date) < '{$from}'" : " AND 1=0");
$pre_discount_filter = (float)($conn->query($pre_discount_sql)->fetch_assoc()['total'] ?? 0);

// Brought forward balance for filtered display = Opening Balance + Previous Repairs + Previous Direct Sales + Previous Loans - Previous Payments
$brought_forward = $opening_bal + $pre_repairs + $pre_direct_sales + $pre_loans - $pre_payments_filter;

// 4. Filter Logic for current table (for display only)
$repair_filter = ""; 
$payment_filter = "";
$direct_sales_filter = "";
$loans_filter = ""; // NEW

if($from && $to){
    $repair_filter = " AND DATE(date_created) BETWEEN '{$from}' AND '{$to}' ";
    $payment_filter = " AND DATE(payment_date) BETWEEN '{$from}' AND '{$to}' ";
    $direct_sales_filter = " AND DATE(date_created) BETWEEN '{$from}' AND '{$to}' ";
    $loans_filter = " AND DATE(loan_date) BETWEEN '{$from}' AND '{$to}' "; // NEW
} else if($from) {
    $repair_filter = " AND DATE(date_created) >= '{$from}' ";
    $payment_filter = " AND DATE(payment_date) >= '{$from}' ";
    $direct_sales_filter = " AND DATE(date_created) >= '{$from}' ";
    $loans_filter = " AND DATE(loan_date) >= '{$from}' ";
} else if($to) {
    $repair_filter = " AND DATE(date_created) <= '{$to}' ";
    $payment_filter = " AND DATE(payment_date) <= '{$to}' ";
    $direct_sales_filter = " AND DATE(date_created) <= '{$to}' ";
    $loans_filter = " AND DATE(loan_date) <= '{$to}' ";
}

// Add status filter to repair filter if repair statuses selected
if($repair_statuses !== null) {
    if(empty($repair_statuses)) {
        $repair_filter .= " AND 1=0";
    } else {
        $repair_filter .= " AND status IN (" . implode(',', $repair_statuses) . ")";
    }
}

// 5. Data Merging with DISCOUNT support (for filtered display) – NOW INCLUDES LOANS
$ledger = [];

// First row for brought forward balance
$ledger[] = [
    'date' => $from ? date("d-m-Y", strtotime($from)) : 'Start', 
    'desc' => 'Balance Brought Forward', 
    'ref' => '-', 
    'status' => null, 
    'remark' => 'Previous Balance', 
    'debit' => $brought_forward, 
    'credit' => 0,
    'discount' => 0,
    'timestamp' => 0,
    'date_completed' => null
];

// Repairs (Debit entries)
$rep_res = $conn->query("SELECT date_created, job_id, item, amount, status, remark, date_completed FROM transaction_list WHERE client_name = '{$id}' {$repair_filter}");
while($row = $rep_res->fetch_assoc()){
    $ledger[] = [
        'date' => date("d-m-Y", strtotime($row['date_created'])), 
        'desc' => "Job: ".$row['item'], 
        'ref' => $row['job_id'], 
        'status' => $row['status'], 
        'remark' => $row['remark'], 
        'debit' => (float)$row['amount'], 
        'credit' => 0,
        'discount' => 0,
        'timestamp' => strtotime($row['date_created']),
        'date_completed' => $row['date_completed']
    ];
}

// Direct Sales (Debit entries)
if($show_direct_sales) {
    $ds_res = $conn->query("SELECT date_created, sale_code, total_amount, remarks FROM direct_sales WHERE client_id = '{$id}' {$direct_sales_filter}");
    while($row = $ds_res->fetch_assoc()){
        $ledger[] = [
            'date' => date("d-m-Y", strtotime($row['date_created'])), 
            'desc' => "Direct Sale", 
            'ref' => $row['sale_code'], 
            'status' => 'direct_sale', 
            'remark' => $row['remarks'], 
            'debit' => (float)$row['total_amount'], 
            'credit' => 0,
            'discount' => 0,
            'timestamp' => strtotime($row['date_created']),
            'date_completed' => null
        ];
    }
}

// NEW: Loans (Debit entries)
if($show_loans) {
    $loan_res = $conn->query("SELECT loan_date, id, total_payable, remarks FROM client_loans WHERE client_id = '{$id}' {$loans_filter}");
    while($row = $loan_res->fetch_assoc()){
        $ledger[] = [
            'date' => date("d-m-Y", strtotime($row['loan_date'])), 
            'desc' => "Loan Disbursement", 
            'ref' => "LN-".str_pad($row['id'], 5, '0', STR_PAD_LEFT), 
            'status' => 'loan', 
            'remark' => $row['remarks'], 
            'debit' => (float)$row['total_payable'], 
            'credit' => 0,
            'discount' => 0,
            'timestamp' => strtotime($row['loan_date']),
            'date_completed' => null
        ];
    }
}

// Payments (Credit entries with DISCOUNT)
if($show_payments) {
    $pay_res = $conn->query("SELECT payment_date, id, amount, discount, remarks FROM client_payments WHERE client_id = '{$id}' {$payment_filter}");
    while($row = $pay_res->fetch_assoc()){
        $ledger[] = [
            'date' => date("d-m-Y", strtotime($row['payment_date'])), 
            'desc' => "Payment Received", 
            'ref' => "PAY-".$row['id'], 
            'status' => 'payment', 
            'remark' => $row['remarks'], 
            'debit' => 0, 
            'credit' => (float)$row['amount'], 
            'discount' => (float)$row['discount'],
            'timestamp' => strtotime($row['payment_date']),
            'date_completed' => null
        ];
    }
}

// Sort by timestamp
usort($ledger, function($a, $b) { 
    return $a['timestamp'] <=> $b['timestamp']; 
});

// Calculate running balance for filtered display
$running_total = 0;

// Create filename for PDF saving
$client_name_for_file = preg_replace('/[^A-Za-z0-9_\-]/', '_', $client['name']);
$current_datetime = date('Y-m-d_H-i-s');
$pdf_filename = "Statement_{$client_name_for_file}_{$current_datetime}.pdf";

// Get all available dates for datepicker suggestions
$min_date_qry = $conn->query("SELECT MIN(DATE(date_created)) as min_date FROM transaction_list WHERE client_name = '{$id}'");
$max_date_qry = $conn->query("SELECT MAX(DATE(date_created)) as max_date FROM transaction_list WHERE client_name = '{$id}'");
$min_date = $min_date_qry->fetch_assoc()['min_date'] ?? date('Y-m-01');
$max_date = $max_date_qry->fetch_assoc()['max_date'] ?? date('Y-m-d');

// Get counts for each status – INCLUDING LOANS
$status_counts = [];
foreach($status_arr as $key => $status_info) {
    if($key === 'payment') {
        $count_qry = $conn->query("SELECT COUNT(*) as count FROM client_payments WHERE client_id = '{$id}'");
    } elseif($key === 'direct_sale') {
        $count_qry = $conn->query("SELECT COUNT(*) as count FROM direct_sales WHERE client_id = '{$id}'");
    } elseif($key === 'loan') {
        $count_qry = $conn->query("SELECT COUNT(*) as count FROM client_loans WHERE client_id = '{$id}'");
    } else {
        $count_qry = $conn->query("SELECT COUNT(*) as count FROM transaction_list WHERE client_name = '{$id}' AND status = '{$key}'");
    }
    $status_counts[$key] = $count_qry->fetch_assoc()['count'] ?? 0;
}

// Get period summaries for display – INCLUDING LOANS
$period_repairs_sql = "SELECT SUM(amount) as total FROM transaction_list WHERE client_name = '{$id}' {$repair_filter}";
$period_repairs_result = $conn->query($period_repairs_sql);
$period_repairs = $period_repairs_result->fetch_assoc()['total'] ?? 0;

$period_direct_sales_sql = "SELECT SUM(total_amount) as total FROM direct_sales WHERE client_id = '{$id}' {$direct_sales_filter}";
$period_direct_sales_result = $conn->query($period_direct_sales_sql);
$period_direct_sales = $period_direct_sales_result->fetch_assoc()['total'] ?? 0;

// NEW: Period loans
$period_loans_sql = "SELECT SUM(total_payable) as total FROM client_loans WHERE client_id = '{$id}' {$loans_filter}";
$period_loans_result = $conn->query($period_loans_sql);
$period_loans = $period_loans_result->fetch_assoc()['total'] ?? 0;

$period_payments = $conn->query("SELECT SUM(amount) as total FROM client_payments WHERE client_id = '{$id}' {$payment_filter}")->fetch_assoc()['total'] ?? 0;
$period_discount = $conn->query("SELECT SUM(discount) as total FROM client_payments WHERE client_id = '{$id}' {$payment_filter}")->fetch_assoc()['total'] ?? 0;
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Statement - <?= htmlspecialchars($client['name']) ?> - <?= date('d-m-Y H:i:s') ?></title>
    <link rel="stylesheet" href="../../dist/css/adminlte.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <!-- Select2 for multiple selection -->
    <link rel="stylesheet" href="../../plugins/select2/css/select2.min.css">
    <link rel="stylesheet" href="../../plugins/select2-bootstrap4-theme/select2-bootstrap4.min.css">
    <style>
        body { 
            background-color: #f4f6f9; 
            font-size: 12px;
            color: #333; 
        }
        
        .statement-container { 
            background: #fff; 
            padding: 20px;
            border-radius: 4px; 
            box-shadow: 0 0 20px rgba(0,0,0,0.1); 
            margin: 15px auto;
            max-width: 1100px; 
            border: 1px solid #ddd; 
        }
        
        .company-logo { 
            max-height: 60px;
            margin-bottom: 5px;
        }
        
        .table-modern { 
            border-collapse: collapse; 
            width: 100%; 
            border: 1px solid #444 !important;
            font-size: 11px;
        }
        
        .table-modern th { 
            background: #001f3f; 
            color: #fff; 
            padding: 8px 6px !important;
            border: 1px solid #444 !important; 
            text-transform: uppercase; 
            font-size: 10px;
            font-weight: 700;
            height: 35px;
        }
        
        .table-modern td { 
            padding: 6px 5px !important;
            border: 1px solid #ddd !important; 
            vertical-align: middle; 
            line-height: 1.2;
            height: 35px;
        }
        
        .status-badge { 
            padding: 2px 6px;
            border-radius: 3px; 
            font-size: 9px;
            font-weight: 700; 
            display: inline-block; 
            text-align: center; 
            min-width: 65px;
            text-transform: uppercase; 
            line-height: 1.2;
        }
        
        .balance-column {
            min-width: 100px;
            width: 15%;
        }
        
        .summary-row {
            margin-bottom: 10px !important;
        }
        
        .summary-card {
            padding: 10px !important;
            margin-bottom: 10px !important;
        }
        
        .action-buttons {
            padding: 15px 0 !important;
        }
        
        .signature-box {
            padding-top: 6px !important;
            width: 180px !important;
            font-size: 11px !important;
        }
        
        .credit-compact {
            font-size: 10px !important;
        }
        
        .credit-compact .text-discount {
            font-size: 9px !important;
            margin-top: 2px !important;
        }
        
        .remark-column {
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .amount-column {
            min-width: 80px;
            font-size: 10px !important;
        }
        
        .bg-dr { background-color: #fff9f9; }
        .bg-cr { background-color: #f9fff9; }
        .text-discount { color: #17a2b8; font-size: 9px; font-weight: 600; }
        
        .filter-container {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .filter-title {
            color: #495057;
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 10px;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 8px;
        }
        
        .date-input-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .date-input {
            flex: 1;
            max-width: 200px;
        }
        
        .date-separator {
            color: #6c757d;
            font-weight: bold;
        }
        
        .quick-dates {
            margin-top: 10px;
        }
        
        .btn-quick-date {
            font-size: 12px;
            padding: 4px 8px;
            margin-right: 5px;
            margin-bottom: 5px;
        }
        
        .select2-container--bootstrap4 .select2-selection--multiple {
            min-height: 38px !important;
        }
        
        .select2-container--bootstrap4 .select2-selection--multiple .select2-selection__choice {
            margin-top: 4px !important;
            margin-bottom: 4px !important;
            padding: 2px 8px !important;
            font-size: 12px !important;
        }
        
        .balance-display-box {
            padding: 8px !important;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        
        .balance-label {
            font-size: 9px !important;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .balance-amount {
            font-size: 1.3rem;
            font-weight: 800;
            letter-spacing: 0.5px;
            margin-top: 2px;
        }
        
        .debit-balance {
            background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
            border: 1px solid #ffcdd2;
        }
        
        .credit-balance {
            background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
            border: 1px solid #c8e6c9;
        }
        
        .zero-balance {
            background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
            border: 1px solid #e0e0e0;
        }
        
        .debit-text {
            color: #c62828;
        }
        
        .credit-text {
            color: #2e7d32;
        }
        
        .zero-text {
            color: #616161;
        }
        
        .payment-badge {
            background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
            color: white;
            border: 1px solid #117a8b;
        }
        
        .direct-sale-badge {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff4757 100%);
            color: white;
            border: 1px solid #ff4757;
        }
        
        /* NEW: Loan badge style */
        .loan-badge {
            background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
            color: white;
            border: 1px solid #8e44ad;
        }
        
        .payment-amount {
            font-weight: bold;
            font-size: 11px;
        }
        
        .discount-note {
            font-size: 8px;
            color: #17a2b8;
            font-style: italic;
        }
        
        .delivered-date {
            font-size: 8px !important;
            color: #28a745 !important;
            font-weight: 600 !important;
            margin-top: 2px !important;
            display: block !important;
            line-height: 1.1 !important;
        }
        
        @media print {
            body { 
                background: #fff; 
                margin: 0; 
                padding: 0; 
                font-size: 10px !important;
            }
            .statement-container { 
                box-shadow: none; 
                margin: 0; 
                padding: 5px;
                max-width: 100%; 
                border: none; 
                page-break-inside: avoid; 
            }
            .no-print { 
                display: none !important; 
            }
            .filter-container {
                display: none !important;
            }
            .table-modern th { 
                background: #001f3f !important; 
                color: #fff !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                padding: 6px 4px !important;
                font-size: 9px !important;
            }
            .table-modern td {
                padding: 5px 4px !important;
                font-size: 10px !important;
            }
            .status-badge { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                border: 1px solid #999 !important; 
                font-size: 8px !important;
                padding: 1px 4px !important;
                min-width: 60px !important;
            }
            .delivered-date {
                font-size: 7px !important;
            }
            
            .table-modern {
                page-break-inside: auto;
            }
            .table-modern tr {
                page-break-inside: avoid;
                page-break-after: auto;
                height: 30px !important;
            }
            .table-modern td, .table-modern th {
                page-break-inside: avoid;
                page-break-after: auto;
            }
            
            @page {
                margin: 0.3cm;
                size: A4 portrait;
                
                @top-left {
                    content: "<?= htmlspecialchars($_settings->info('name')) ?>";
                    font-size: 8px;
                    color: #666;
                }
                @top-right {
                    content: "<?= date('d/m/Y H:i:s') ?>";
                    font-size: 8px;
                    color: #666;
                }
                @bottom-center {
                    content: "Page " counter(page) " of " counter(pages);
                    font-size: 8px;
                    color: #666;
                }
                @bottom-left {
                    content: "Client: <?= htmlspecialchars($client['name']) ?>";
                    font-size: 8px;
                    color: #666;
                }
                @bottom-right {
                    content: "Period: <?= $from ? date('d/m/Y', strtotime($from)) : 'All' ?> - <?= $to ? date('d/m/Y', strtotime($to)) : 'All' ?>";
                    font-size: 8px;
                    color: #666;
                }
            }
        }
        
        @media screen {
            .print-button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                font-size: 13px;
            }
            .print-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
        }
    </style>
</head>
<body>
    <!-- FILTER FORM WITH MULTIPLE STATUS FILTER -->
    <div class="filter-container no-print">
        <div class="filter-title">
            <i class="fas fa-filter mr-1"></i> Filter Data for Statement
        </div>
        <form method="GET" action="" id="filterForm">
            <input type="hidden" name="id" value="<?= $id ?>">
            
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="dateRange" class="small font-weight-bold">Select Date Range:</label>
                        <div class="date-input-group">
                            <input type="date" name="from" id="fromDate" class="form-control form-control-sm date-input" 
                                   value="<?= $from ?>" max="<?= $max_date ?>">
                            <span class="date-separator">to</span>
                            <input type="date" name="to" id="toDate" class="form-control form-control-sm date-input" 
                                   value="<?= $to ?>" max="<?= $max_date ?>">
                        </div>
                    </div>
                    
                    <div class="quick-dates">
                        <span class="small font-weight-bold mr-2">Quick Dates:</span>
                        <button type="button" class="btn btn-outline-primary btn-quick-date" data-days="7">Last 7 Days</button>
                        <button type="button" class="btn btn-outline-primary btn-quick-date" data-days="30">Last 30 Days</button>
                        <button type="button" class="btn btn-outline-primary btn-quick-date" data-month="current">Current Month</button>
                        <button type="button" class="btn btn-outline-primary btn-quick-date" data-month="previous">Previous Month</button>
                        <button type="button" class="btn btn-outline-secondary btn-quick-date" onclick="clearFilter()">Clear All Filters</button>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="form-group">
                        <label class="small font-weight-bold mb-2">Filter by Status (Multiple Selection):</label>
                        <select class="form-control select2" name="status[]" id="statusSelect" multiple="multiple" data-placeholder="Select statuses...">
                            <?php foreach($status_arr as $key => $status_info): ?>
                            <option value="<?= $key ?>" 
                                <?= in_array($key, $status_filters) ? 'selected' : '' ?>
                                data-color="<?= $status_info['color'] ?>">
                                <?= $status_info['label'] ?> (<?= $status_counts[$key] ?>)
                            </option>
                            <?php endforeach; ?>
                        </select>
                        <small class="form-text text-muted">
                            <i class="fas fa-info-circle mr-1"></i>
                            Select multiple statuses to filter. Leave empty to show all records.
                        </small>
                    </div>
                    
                    <div class="form-group mt-2">
                        <button type="submit" class="btn btn-primary btn-block">
                            <i class="fas fa-search mr-1"></i> Apply Filters (For Display Only)
                        </button>
                        <?php if($from || $to || !empty($status_filters)): ?>
                        <div class="mt-2 text-center small text-success">
                            <i class="fas fa-check-circle mr-1"></i>
                            Filters Applied (Display Only): 
                            <?= $from ? date('d/m/Y', strtotime($from)) : 'All Dates' ?> 
                            to 
                            <?= $to ? date('d/m/Y', strtotime($to)) : 'All Dates' ?>
                            <?php if(!empty($status_filters)): ?>
                            <br><b>Status:</b> 
                            <?php 
                            $selected_labels = [];
                            foreach($status_filters as $filter) {
                                if(isset($status_arr[$filter])) {
                                    $selected_labels[] = $status_arr[$filter]['label'];
                                }
                            }
                            echo implode(', ', $selected_labels);
                            ?>
                            <?php endif; ?>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </form>
    </div>

    <div class="statement-container">
        <!-- COMPACT HEADER -->
        <div class="row mb-3 summary-row">
            <div class="col-7">
                <img src="../../uploads/logo.png" alt="Company Logo" class="company-logo" onerror="this.src='../../dist/img/AdminLTELogo.png';">
                <h5 class="mb-0 text-navy" style="font-size: 1.1rem;"><b><?= htmlspecialchars($_settings->info('name')) ?></b></h5>
                <p class="mb-0 small text-muted" style="font-size: 10px; line-height: 1.2;">
                    <?= htmlspecialchars($_settings->info('address')) ?><br>Contact: <?= htmlspecialchars($_settings->info('contact')) ?>
                </p>
            </div>
            <div class="col-5 text-right">
                <h3 class="text-secondary mb-1" style="letter-spacing: 1px; font-weight: 900; font-size: 1.4rem;">STATEMENT</h3>
                <p class="mb-0" style="font-size: 11px;"><b>Generated:</b> <?= date("d M, Y H:i:s") ?></p>
                <?php if($from || $to || !empty($status_filters)): ?>
                <p class="mb-0" style="font-size: 10px; color: #6c757d;">
                    <b>Display Period:</b> <?= $from ? date('d/m/Y', strtotime($from)) : 'All' ?> 
                    to <?= $to ? date('d/m/Y', strtotime($to)) : 'All' ?>
                    <?php if(!empty($status_filters)): ?>
                    <br><b>Status:</b> 
                    <?php 
                    $selected_labels = [];
                    foreach($status_filters as $filter) {
                        if(isset($status_arr[$filter])) {
                            $selected_labels[] = $status_arr[$filter]['label'];
                        }
                    }
                    echo implode(', ', $selected_labels);
                    ?>
                    <?php endif; ?>
                </p>
                <?php endif; ?>
                <p class="mb-0 small text-muted" id="filenameInfo" style="display: none; font-size: 9px;">
                    File: <?= $pdf_filename ?>
                </p>
            </div>
        </div>

        <hr style="border-top: 1px solid #001f3f; margin: 10px 0;">

        <!-- COMPACT CLIENT INFO & BALANCE -->
        <div class="row mb-3 summary-row">
            <div class="col-6">
                <p class="text-muted mb-0 small" style="font-size: 10px;"><b>Account Holder:</b></p>
                <h5 class="mb-0" style="font-size: 1rem;"><b><?= htmlspecialchars($client['name']) ?></b></h5>
                <p class="mb-0" style="font-size: 11px;">Ph: <?= htmlspecialchars($client['contact']) ?></p>
                <p class="mb-0" style="font-size: 11px;">Add: <?= htmlspecialchars($client['address']) ?></p>
            </div>
            <div class="col-6 text-right">
                <div class="p-2 balance-display-box <?= $balance_type ?>-balance" style="padding: 8px !important;">
                    <p class="mb-0 small balance-label <?= $balance_type ?>-text">
                        <?= $balance_label ?>
                    </p>
                    <h3 class="mb-0 balance-amount <?= $balance_type ?>-text" id="current_outstanding">
                        ₹ <?= number_format($current_outstanding, 2) ?>
                    </h3>
                    <?php if($balance_type === 'credit'): ?>
                    <p class="mb-0 small text-muted" style="font-size: 8px; margin-top: 2px;">
                        (Credit Balance - Amount to be paid to client)
                    </p>
                    <?php elseif($balance_type === 'debit'): ?>
                    <p class="mb-0 small text-muted" style="font-size: 8px; margin-top: 2px;">
                        (Debit Balance - Amount receivable from client)
                    </p>
                    <?php else: ?>
                    <p class="mb-0 small text-muted" style="font-size: 8px; margin-top: 2px;">
                        (Account is fully settled)
                    </p>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- DISPLAY PERIOD SUMMARY - NOW INCLUDING LOANS -->
        <?php if($from || $to || !empty($status_filters)): ?>
        <div class="row mb-3 summary-row">
            <div class="col-12">
                <div class="alert alert-secondary p-2" style="padding: 8px !important;">
                    <h6 class="mb-1" style="font-size: 11px;">
                        <i class="fas fa-calendar-alt mr-1"></i> Display Period Summary:
                    </h6>
                    <div class="row">
                        <div class="col-3">
                            <p class="mb-0" style="font-size: 10px;"><b>Period Repairs:</b> ₹ <?= number_format($period_repairs, 2) ?></p>
                        </div>
                        <div class="col-3">
                            <p class="mb-0" style="font-size: 10px;"><b>Period Direct Sales:</b> ₹ <?= number_format($period_direct_sales, 2) ?></p>
                        </div>
                        <div class="col-3">
                            <p class="mb-0" style="font-size: 10px;"><b>Period Loans:</b> ₹ <?= number_format($period_loans, 2) ?></p>
                        </div>
                        <div class="col-3">
                            <p class="mb-0" style="font-size: 10px;"><b>Period Payments:</b> ₹ <?= number_format($period_payments, 2) ?></p>
                            <p class="mb-0" style="font-size: 9px;"><b>Period Discount:</b> ₹ <?= number_format($period_discount, 2) ?></p>
                        </div>
                    </div>
                    <div class="row mt-1">
                        <div class="col-12">
                            <p class="mb-0" style="font-size: 10px;"><b>Brought Forward:</b> ₹ <?= number_format($brought_forward, 2) ?></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php endif; ?>

        <!-- LEDGER TABLE -->
        <div class="table-responsive">
            <table class="table-modern">
                <thead>
                    <tr>
                        <th class="text-center" width="4%">#</th>
                        <th width="10%">Date</th>
                        <th width="22%">Description</th>
                        <th class="text-center" width="10%">Ref ID</th>
                        <th class="text-center" width="10%">Status</th>
                        <th class="remark-column" width="12%">Remark</th>
                        <th class="text-right amount-column" width="10%">Debit (Dr)</th>
                        <th class="text-right amount-column" width="12%">Credit (Cr)</th>
                        <th class="text-right balance-column" width="12%">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $running_total = 0; 
                    $i = 1;
                    $total_debit = 0;
                    $total_credit = 0;
                    $total_discount = 0;
                    
                    if(empty($ledger) || (count($ledger) == 1 && $ledger[0]['desc'] == 'Balance Brought Forward' && $ledger[0]['debit'] == 0)): 
                    ?>
                    <tr>
                        <td colspan="9" class="text-center py-4">
                            <div class="alert alert-warning mb-0">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                No records found with the current filters.
                                <?php if(!empty($status_filters)): ?>
                                <br><small class="mt-1">Try changing the status filter or date range.</small>
                                <?php endif; ?>
                            </div>
                        </td>
                    </tr>
                    <?php else: 
                    foreach($ledger as $row): 
                        $effective_credit = $row['credit'] + $row['discount'];
                        $running_total += ($row['debit'] - $effective_credit);
                        $total_debit += $row['debit'];
                        $total_credit += $row['credit'];
                        $total_discount += $row['discount'];
                    ?>
                    <tr class="<?= $row['debit'] > 0 ? 'bg-dr' : ($row['credit'] > 0 ? 'bg-cr' : '') ?>">
                        <td class="text-center text-muted"><?= $i++ ?></td>
                        <td class="text-nowrap"><?= $row['date'] ?></td>
                        <td><b><?= $row['desc'] ?></b></td>
                        <td class="text-center small"><?= $row['ref'] ?></td>
                        <td class="text-center">
                            <?php if($row['status'] === 'payment'): ?>
                                <span class="status-badge payment-badge">PAYMENT</span>
                            <?php elseif($row['status'] === 'direct_sale'): ?>
                                <span class="status-badge direct-sale-badge">DIRECT SALE</span>
                            <?php elseif($row['status'] === 'loan'): ?>
                                <span class="status-badge loan-badge">LOAN</span>
                            <?php elseif($row['status'] !== null): ?>
                                <?php $s = $status_arr[$row['status']]; ?>
                                <span class="status-badge" style="background:<?= $s['color'] ?>; color:<?= $s['text'] ?>;">
                                    <?= $s['label'] ?>
                                </span>
                                <?php 
                                if($row['status'] == 5 && !empty($row['date_completed'])): 
                                    $delivered_date = date("d M Y", strtotime($row['date_completed']));
                                ?>
                                    <small class="delivered-date">
                                        <i class="fa fa-calendar-check"></i> <?= $delivered_date ?>
                                    </small>
                                <?php endif; ?>
                            <?php else: ?> - <?php endif; ?>
                        </td>
                        <td class="small text-muted italic remark-column" title="<?= htmlspecialchars($row['remark'] ?: '-') ?>">
                            <?= mb_strimwidth($row['remark'] ?: '-', 0, 20, '...') ?>
                        </td>
                        <td class="text-right text-danger amount-column">
                            <?php if($row['debit'] > 0): ?>
                                ₹ <?= number_format($row['debit'], 2) ?>
                            <?php else: ?>
                                -
                            <?php endif; ?>
                        </td>
                        <td class="text-right text-success credit-compact">
                            <?php if($row['credit'] > 0 || $row['discount'] > 0): ?>
                                <div class="payment-amount">
                                    ₹ <?= number_format($effective_credit, 2) ?>
                                </div>
                                <?php if($row['discount'] > 0): ?>
                                <div class="discount-note">
                                    (₹ <?= number_format($row['credit'], 2) ?> payment + ₹ <?= number_format($row['discount'], 2) ?> discount)
                                </div>
                                <?php endif; ?>
                            <?php else: ?>
                                -
                            <?php endif; ?>
                        </td>
                        <td class="text-right balance-column" style="font-weight: bold; font-size: 11px;">
                            ₹ <?= number_format($running_total, 2) ?>
                        </td>
                    </tr>
                    <?php endforeach; endif; ?>
                </tbody>
                <tfoot>
                    <tr style="background: #f8f9fa; font-weight: bold;">
                        <th colspan="6" class="text-right" style="padding: 8px; font-size: 11px;">Display Period Totals:</th>
                        <th class="text-right" style="padding: 8px; color: #dc3545; font-size: 11px;">
                            ₹ <?= number_format($total_debit, 2) ?>
                        </th>
                        <th class="text-right" style="padding: 8px; color: #28a745; font-size: 11px;">
                            <div>₹ <?= number_format($total_credit, 2) ?></div>
                            <div class="text-discount">(Discount: ₹ <?= number_format($total_discount, 2) ?>)</div>
                        </th>
                        <th class="text-right" style="padding: 8px; font-size: 11px;">-</th>
                    </tr>
                    <tr style="background: #eee; font-weight: bold;">
                        <th colspan="8" class="text-right" style="padding: 10px; font-size: 12px;">
                            DISPLAY PERIOD BALANCE:
                        </th>
                        <th class="text-right balance-column" style="padding: 10px; font-size: 1.1rem; color: #dc3545;">
                            ₹ <?= number_format($running_total, 2) ?>
                        </th>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div class="row mt-3">
            <div class="col-12">
                <div class="alert alert-info p-2" style="padding: 8px !important;">
                    <h6 class="mb-1" style="font-size: 11px;"><i class="fas fa-info-circle mr-1"></i> Summary:</h6>
                    <div class="row">
                        <div class="col-4">
                            <p class="mb-0" style="font-size: 10px;"><b>Opening Balance:</b> ₹ <?= number_format($opening_bal, 2) ?></p>
                            <p class="mb-0" style="font-size: 10px;"><b>Total Repairs:</b> ₹ <?= number_format($total_repairs, 2) ?></p>
                            <p class="mb-0" style="font-size: 10px;"><b>Total Direct Sales:</b> ₹ <?= number_format($total_direct_sales, 2) ?></p>
                        </div>
                        <div class="col-4">
                            <p class="mb-0" style="font-size: 10px;"><b>Total Loans:</b> ₹ <?= number_format($total_loans, 2) ?></p>
                            <p class="mb-0" style="font-size: 10px;"><b>Total Payments:</b> ₹ <?= number_format($total_payments - $total_discount, 2) ?></p>
                            <p class="mb-0" style="font-size: 10px;"><b>Total Discount:</b> ₹ <?= number_format($total_discount, 2) ?></p>
                        </div>
                        <div class="col-4">
                            <p class="mb-0" style="font-size: 10px;"><b>Net Balance:</b> ₹ <?= number_format($opening_bal + $total_repairs + $total_direct_sales + $total_loans - $total_payments, 2) ?></p>
                            <p class="mb-0" style="font-size: 9px; <?= $balance_type === 'credit' ? 'color:#28a745;' : ($balance_type === 'debit' ? 'color:#dc3545;' : 'color:#6c757d;') ?>">
                                <b>Status:</b> <?= $balance_label ?>
                            </p>
                        </div>
                    </div>
                    <?php if(!empty($status_filters)): ?>
                    <div class="row mt-1">
                        <div class="col-12">
                            <p class="mb-0 small text-warning" style="font-size: 9px;">
                                <i class="fas fa-info-circle mr-1"></i> 
                                <b>Note:</b> Display filter is applied for selected statuses only. 
                                Current outstanding balance (top right) is calculated from ALL transactions.
                            </p>
                        </div>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <script>
            function printWithFilename() {
                var originalTitle = document.title;
                var clientName = "<?= addslashes($client['name']) ?>";
                var currentDate = "<?= date('Y-m-d_H-i-s') ?>";
                var cleanClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
                var newTitle = "Statement_" + cleanClientName + "_" + currentDate;
                
                document.title = newTitle;
                document.getElementById('filenameInfo').style.display = 'block';
                
                setTimeout(function() {
                    window.print();
                    setTimeout(function() {
                        document.title = originalTitle;
                        document.getElementById('filenameInfo').style.display = 'none';
                    }, 1000);
                }, 100);
            }
        </script>

        <!-- SIGNATURES -->
        <div class="row mt-3 pt-2 text-center">
            <div class="col-5">
                <div class="signature-box">
                    Customer Signature
                </div>
            </div>
            <div class="col-2"></div>
            <div class="col-5">
                <div class="signature-box">
                    Authorized Signatory
                </div>
            </div>
        </div>

        <!-- ACTION BUTTONS -->
        <div class="text-center no-print mt-3 pt-2 border-top action-buttons">
            <button onclick="printWithFilename()" class="btn btn-navy btn-lg px-4 shadow print-button" style="font-size: 13px; padding: 8px 20px;">
                <i class="fa fa-print"></i> Print Statement
            </button>
            <button onclick="window.close()" class="btn btn-default btn-lg px-4 ml-2" style="font-size: 13px; padding: 8px 20px;">
                <i class="fa fa-times"></i> Close
            </button>
        </div>
    </div>
    
    <!-- JavaScript -->
    <script src="../../plugins/jquery/jquery.min.js"></script>
    <script src="../../plugins/moment/moment.min.js"></script>
    <script src="../../plugins/select2/js/select2.full.min.js"></script>
    <script>
        $(document).ready(function() {
            $('#statusSelect').select2({
                theme: 'bootstrap4',
                width: '100%',
                placeholder: 'Select statuses...',
                allowClear: true,
                templateResult: formatStatusOption,
                templateSelection: formatStatusSelection,
                escapeMarkup: function(m) { return m; }
            });
            
            function formatStatusOption(state) {
                if (!state.id) {
                    return state.text;
                }
                var color = $(state.element).data('color');
                var $option = $(
                    '<span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;background:' + color + '"></span> ' + state.text + '</span>'
                );
                return $option;
            }
            
            function formatStatusSelection(state) {
                if (!state.id) {
                    return state.text;
                }
                var color = $(state.element).data('color');
                var $selection = $(
                    '<span style="background:' + color + ';color:#fff;padding:2px 8px;border-radius:3px;font-size:12px;">' + state.text + '</span>'
                );
                return $selection;
            }
        });

        document.querySelectorAll('.btn-quick-date').forEach(button => {
            button.addEventListener('click', function() {
                const fromInput = document.getElementById('fromDate');
                const toInput = document.getElementById('toDate');
                const today = new Date();
                
                if (this.dataset.days) {
                    const days = parseInt(this.dataset.days);
                    const fromDate = new Date();
                    fromDate.setDate(today.getDate() - days);
                    fromInput.value = fromDate.toISOString().split('T')[0];
                    toInput.value = today.toISOString().split('T')[0];
                } else if (this.dataset.month === 'current') {
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    fromInput.value = firstDay.toISOString().split('T')[0];
                    toInput.value = lastDay.toISOString().split('T')[0];
                } else if (this.dataset.month === 'previous') {
                    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
                    fromInput.value = firstDay.toISOString().split('T')[0];
                    toInput.value = lastDay.toISOString().split('T')[0];
                }
                
                setTimeout(() => {
                    document.getElementById('filterForm').submit();
                }, 300);
            });
        });

        function clearFilter() {
            window.location.href = '?id=<?= $id ?>';
        }

        document.getElementById('filterForm').addEventListener('submit', function(e) {
            const fromDate = document.getElementById('fromDate').value;
            const toDate = document.getElementById('toDate').value;
            
            if (fromDate && toDate && fromDate > toDate) {
                alert('From date cannot be after To date!');
                e.preventDefault();
                return false;
            }
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Applying Filters...';
            submitBtn.disabled = true;
            
            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 2000);
        });

        document.getElementById('fromDate').max = '<?= $max_date ?>';
        document.getElementById('toDate').max = '<?= $max_date ?>';
        
        const fromDateInput = document.getElementById('fromDate');
        const toDateInput = document.getElementById('toDate');
        
        fromDateInput.addEventListener('change', function() {
            toDateInput.min = this.value;
        });
    </script>
</body>
</html>