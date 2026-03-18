<?php
//session_start();
require_once('../config.php'); // आपका database connection

$title = 'V-Tech Accounting Dashboard';
//require_once('header.php');

// डेट रेंज सेट करें
$start_date = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-01');
$end_date = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-t');
$report_type = isset($_GET['report_type']) ? $_GET['report_type'] : 'cash_flow';

// रिपोर्ट जनरेट करने का फंक्शन
function getCashFlowReport($conn, $start_date, $end_date) {
    $report = [
        'income' => [],
        'expenses' => [],
        'summary' => []
    ];
    
    // 1. जॉब से आय
    $job_query = $conn->query("
        SELECT 
            COALESCE(SUM(t.amount), 0) as total_job_income,
            COUNT(t.id) as total_jobs,
            COALESCE(SUM(t.mechanic_commission_amount), 0) as commission_paid
        FROM transaction_list t
        WHERE t.status IN (5) 
        AND DATE(t.date_created) BETWEEN '$start_date' AND '$end_date'
    ");
    $job_income = $job_query->fetch_assoc();
    
    $report['income']['job_income'] = [
        'label' => 'Job/Service Income',
        'amount' => floatval($job_income['total_job_income']),
        'details' => [
            'Total Jobs' => $job_income['total_jobs'],
            'Commission Paid' => $job_income['commission_paid']
        ]
    ];
    
    // 2. डायरेक्ट सेल्स
    $sales_query = $conn->query("
        SELECT 
            COALESCE(SUM(total_amount), 0) as total_sales,
            COUNT(id) as total_sales_count
        FROM direct_sales 
        WHERE DATE(date_created) BETWEEN '$start_date' AND '$end_date'
    ");
    $sales_income = $sales_query->fetch_assoc();
    
    $report['income']['direct_sales'] = [
        'label' => 'Direct Sales',
        'amount' => floatval($sales_income['total_sales']),
        'details' => [
            'Total Sales' => $sales_income['total_sales_count']
        ]
    ];
    
    // 3. ग्राहक भुगतान
    $payment_query = $conn->query("
        SELECT 
            COALESCE(SUM(amount), 0) as total_payments,
            COALESCE(SUM(discount), 0) as total_discount,
            COUNT(id) as payment_count
        FROM client_payments 
        WHERE payment_date BETWEEN '$start_date' AND '$end_date'
    ");
    $client_payments = $payment_query->fetch_assoc();
    
    $report['income']['client_payments'] = [
        'label' => 'Client Payments',
        'amount' => floatval($client_payments['total_payments']),
        'details' => [
            'Total Payments' => $client_payments['payment_count'],
            'Discount' => $client_payments['total_discount']
        ]
    ];
    
    // 4. मैकेनिक सैलरी/एडवांस
    $salary_query = $conn->query("
        SELECT 
            COALESCE(SUM(amount), 0) as total_advance,
            COUNT(id) as advance_count
        FROM advance_payments 
        WHERE date_paid BETWEEN '$start_date' AND '$end_date'
    ");
    $salary_expense = $salary_query->fetch_assoc();
    
    $report['expenses']['salary_advance'] = [
        'label' => 'Mechanic Salary/Advance',
        'amount' => floatval($salary_expense['total_advance']),
        'details' => [
            'Total Payments' => $salary_expense['advance_count']
        ]
    ];
    
    // 5. दुकान के खर्चे
    $expense_query = $conn->query("
        SELECT 
            COALESCE(SUM(amount), 0) as total_expenses,
            GROUP_CONCAT(CONCAT(category, ': ₹', amount) SEPARATOR ', ') as expense_details
        FROM expense_list 
        WHERE DATE(date_created) BETWEEN '$start_date' AND '$end_date'
    ");
    $shop_expenses = $expense_query->fetch_assoc();
    
    $report['expenses']['shop_expenses'] = [
        'label' => 'Shop Expenses',
        'amount' => floatval($shop_expenses['total_expenses']),
        'details' => [
            'Details' => $shop_expenses['expense_details'] ?: 'No expenses'
        ]
    ];
    
    // 6. लोन EMI
    $loan_query = $conn->query("
        SELECT 
            COALESCE(SUM(amount_paid), 0) as total_emi,
            COUNT(id) as emi_count
        FROM loan_payments 
        WHERE payment_date BETWEEN '$start_date' AND '$end_date'
    ");
    $loan_emi = $loan_query->fetch_assoc();
    
    $report['expenses']['loan_emi'] = [
        'label' => 'Loan EMI',
        'amount' => floatval($loan_emi['total_emi']),
        'details' => [
            'Total EMI' => $loan_emi['emi_count']
        ]
    ];
    
    // 7. अन्य छूट
    $discount_query = $conn->query("
        SELECT 
            COALESCE(SUM(discount), 0) as total_discount_given
        FROM client_payments 
        WHERE payment_date BETWEEN '$start_date' AND '$end_date'
    ");
    $discounts = $discount_query->fetch_assoc();
    
    $report['expenses']['discounts'] = [
        'label' => 'Client Discount',
        'amount' => floatval($discounts['total_discount_given']),
        'details' => []
    ];
    
    // कुल आय और व्यय
    $total_income = $report['income']['job_income']['amount'] + 
                   $report['income']['direct_sales']['amount'] + 
                   $report['income']['client_payments']['amount'];
    
    $total_expenses = $report['expenses']['salary_advance']['amount'] + 
                     $report['expenses']['shop_expenses']['amount'] + 
                     $report['expenses']['loan_emi']['amount'] + 
                     $report['expenses']['discounts']['amount'];
    
    $net_profit = $total_income - $total_expenses;
    
    $report['summary'] = [
        'total_income' => $total_income,
        'total_expenses' => $total_expenses,
        'net_profit' => $net_profit,
        'period' => "From $start_date to $end_date"
    ];
    
    return $report;
}

// ट्रेडिंग अकाउंट रिपोर्ट
function getTradingAccount($conn, $start_date, $end_date) {
    $report = [
        'opening_stock' => 0,
        'purchases' => 0,
        'closing_stock' => 0,
        'gross_profit' => 0,
        'expenses' => [],
        'net_profit' => 0
    ];
    
    // Opening Stock (पहले दिन से पहले का inventory value)
    $opening_stock_query = $conn->query("
        SELECT 
            COALESCE(SUM(il.quantity * p.price), 0) as stock_value
        FROM inventory_list il
        JOIN product_list p ON il.product_id = p.id
        WHERE il.stock_date < '$start_date'
    ");
    $opening_stock = $opening_stock_query->fetch_assoc();
    $report['opening_stock'] = floatval($opening_stock['stock_value']);
    
    // Purchases (इन्वेंटरी में नए सामान)
    $purchases_query = $conn->query("
        SELECT 
            COALESCE(SUM(il.quantity * p.price), 0) as purchase_value,
            COUNT(il.id) as purchase_items
        FROM inventory_list il
        JOIN product_list p ON il.product_id = p.id
        WHERE il.stock_date BETWEEN '$start_date' AND '$end_date'
    ");
    $purchases = $purchases_query->fetch_assoc();
    $report['purchases'] = floatval($purchases['purchase_value']);
    
    // Closing Stock (अंतिम दिन का inventory value)
    $closing_stock_query = $conn->query("
        SELECT 
            COALESCE(SUM(il.quantity * p.price), 0) as stock_value
        FROM inventory_list il
        JOIN product_list p ON il.product_id = p.id
        WHERE il.stock_date <= '$end_date'
    ");
    $closing_stock = $closing_stock_query->fetch_assoc();
    $report['closing_stock'] = floatval($closing_stock['stock_value']);
    
    // Sales (कैश फ्लो से)
    $cash_flow = getCashFlowReport($conn, $start_date, $end_date);
    $sales = $cash_flow['summary']['total_income'];
    
    // Cost of Goods Sold (बेचे गए माल की लागत)
    $cogs = $report['opening_stock'] + $report['purchases'] - $report['closing_stock'];
    
    // Gross Profit
    $report['gross_profit'] = $sales - $cogs;
    
    // Expenses (कैश फ्लो से लें)
    $report['expenses'] = [
        'Salary/Advance' => $cash_flow['expenses']['salary_advance']['amount'],
        'Shop Expenses' => $cash_flow['expenses']['shop_expenses']['amount'],
        'Loan EMI' => $cash_flow['expenses']['loan_emi']['amount'],
        'Discounts' => $cash_flow['expenses']['discounts']['amount']
    ];
    
    // Total Expenses
    $total_expenses = array_sum($report['expenses']);
    
    // Net Profit
    $report['net_profit'] = $report['gross_profit'] - $total_expenses;
    
    return $report;
}

// बैलेंस शीट
function getBalanceSheet($conn, $as_on_date) {
    $balance_sheet = [
        'assets' => [],
        'liabilities' => [],
        'equity' => []
    ];
    
    // ASSETS
    // 1. Cash & Bank (कैश फ्लो से net profit)
    $cash_query = $conn->query("
        SELECT 
            COALESCE(SUM(
                (SELECT COALESCE(SUM(amount), 0) FROM client_payments WHERE payment_date <= '$as_on_date') +
                (SELECT COALESCE(SUM(total_amount), 0) FROM direct_sales WHERE DATE(date_created) <= '$as_on_date') +
                (SELECT COALESCE(SUM(amount), 0) FROM transaction_list WHERE status IN (2,3,5) AND DATE(date_created) <= '$as_on_date') -
                (SELECT COALESCE(SUM(amount), 0) FROM advance_payments WHERE date_paid <= '$as_on_date') -
                (SELECT COALESCE(SUM(amount), 0) FROM expense_list WHERE DATE(date_created) <= '$as_on_date') -
                (SELECT COALESCE(SUM(amount_paid), 0) FROM loan_payments WHERE payment_date <= '$as_on_date')
            ), 0) as cash_balance
    ");
    $cash = $cash_query->fetch_assoc();
    $balance_sheet['assets']['cash_bank'] = [
        'label' => 'Cash/Bank Balance',
        'amount' => floatval($cash['cash_balance'])
    ];
    
    // 2. Inventory (स्टॉक)
    $inventory_query = $conn->query("
        SELECT 
            COALESCE(SUM(il.quantity * p.price), 0) as stock_value
        FROM inventory_list il
        JOIN product_list p ON il.product_id = p.id
        WHERE il.stock_date <= '$as_on_date'
    ");
    $inventory = $inventory_query->fetch_assoc();
    $balance_sheet['assets']['inventory'] = [
        'label' => 'Stock/Inventory',
        'amount' => floatval($inventory['stock_value'])
    ];
    
    // 3. Accounts Receivable (ग्राहक बकाया)
    $receivable_query = $conn->query("
        SELECT 
            COALESCE(SUM(cl.opening_balance), 0) as opening_balance,
            COALESCE(SUM(
                (SELECT COALESCE(SUM(amount), 0) FROM transaction_list WHERE client_name = cl.id AND status IN (2,3,5) AND DATE(date_created) <= '$as_on_date') -
                (SELECT COALESCE(SUM(amount), 0) FROM client_payments WHERE client_id = cl.id AND payment_date <= '$as_on_date')
            ), 0) as pending_amount
        FROM client_list cl
        WHERE cl.delete_flag = 0
    ");
    $receivables = $receivable_query->fetch_assoc();
    $balance_sheet['assets']['receivables'] = [
        'label' => 'Customer Dues',
        'amount' => floatval($receivables['opening_balance'] + $receivables['pending_amount'])
    ];
    
    // LIABILITIES
    // 1. Loan Payable (बकाया लोन)
    $loan_query = $conn->query("
        SELECT 
            COALESCE(SUM(loan_amount - 
                COALESCE((SELECT SUM(amount_paid) FROM loan_payments WHERE lender_id = l.id AND payment_date <= '$as_on_date'), 0)
            ), 0) as outstanding_loan
        FROM lender_list l
        WHERE l.status = 1
    ");
    $loan = $loan_query->fetch_assoc();
    $balance_sheet['liabilities']['loan_payable'] = [
        'label' => 'Outstanding Loan',
        'amount' => floatval($loan['outstanding_loan'])
    ];
    
    // EQUITY
    // 1. Capital (शुरुआती पूंजी - यह आपको manually डालना होगा या system_info में store करना होगा)
    $capital = 100000; // उदाहरण के लिए, आप इसे डेटाबेस में store कर सकते हैं
    $balance_sheet['equity']['capital'] = [
        'label' => 'Capital',
        'amount' => $capital
    ];
    
    // 2. Retained Earnings (संचित लाभ)
    // कुल assets - कुल liabilities - capital
    $total_assets = array_sum(array_column($balance_sheet['assets'], 'amount'));
    $total_liabilities = array_sum(array_column($balance_sheet['liabilities'], 'amount'));
    $retained_earnings = $total_assets - $total_liabilities - $capital;
    
    $balance_sheet['equity']['retained_earnings'] = [
        'label' => 'Retained Earnings',
        'amount' => $retained_earnings
    ];
    
    // Totals
    $balance_sheet['total_assets'] = $total_assets;
    $balance_sheet['total_liabilities_equity'] = $total_liabilities + $capital + $retained_earnings;
    
    return $balance_sheet;
}

// रिपोर्ट जनरेट करें
$cash_flow_report = getCashFlowReport($conn, $start_date, $end_date);
$trading_account = getTradingAccount($conn, $start_date, $end_date);
$balance_sheet = getBalanceSheet($conn, $end_date);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>V-Tech Accounting Dashboard</title>
    <style>
        body {
            font-family: 'Arial', 'Segoe UI', sans-serif;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .filter-form {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .report-section {
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .income-box {
            border-left: 5px solid #28a745;
            background: #f8fff9;
        }
        .expense-box {
            border-left: 5px solid #dc3545;
            background: #fff8f8;
        }
        .profit-box {
            border-left: 5px solid #ffc107;
            background: #fffdf2;
        }
        .amount {
            font-size: 1.5rem;
            font-weight: bold;
        }
        .positive {
            color: #28a745;
        }
        .negative {
            color: #dc3545;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
        }
        .table th {
            background-color: #f1f3f5;
            font-weight: 600;
        }
        .nav-tabs .nav-link {
            font-weight: 600;
            color: #495057;
        }
        .nav-tabs .nav-link.active {
            background-color: #667eea;
            color: white;
            border-color: #667eea;
        }
        @media print {
            .no-print {
                display: none;
            }
            .report-section {
                box-shadow: none;
                border: 1px solid #dee2e6;
            }
        }
        .btn-group {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 20px;
        }
    </style>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css">
</head>
<body>
    <div class="container">
        <!-- हेडर -->
        <div class="header text-center">
            <h1><i class="bi bi-calculator"></i> V-Tech Accounting Dashboard</h1>
            <p class="mb-0">Business Financial Management</p>
        </div>

        <!-- फिल्टर फॉर्म -->
        <div class="filter-form no-print">
            <form method="GET" action="" class="row g-3">
                <!-- Current page parameter -->
                <input type="hidden" name="page" value="reports/accounting_dashboard">
                
                <div class="col-md-3">
                    <label class="form-label">Report Type</label>
                    <select name="report_type" class="form-select" id="reportType">
                        <option value="cash_flow" <?= $report_type == 'cash_flow' ? 'selected' : '' ?>>Cash Flow</option>
                        <option value="trading_account" <?= $report_type == 'trading_account' ? 'selected' : '' ?>>Trading Account</option>
                        <option value="balance_sheet" <?= $report_type == 'balance_sheet' ? 'selected' : '' ?>>Balance Sheet</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Start Date</label>
                    <input type="date" name="start_date" class="form-control" id="startDate" value="<?= $start_date ?>" required>
                </div>
                <div class="col-md-3">
                    <label class="form-label">End Date</label>
                    <input type="date" name="end_date" class="form-control" id="endDate" value="<?= $end_date ?>" required>
                </div>
                <div class="col-md-3 d-flex align-items-end">
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="bi bi-search"></i> View Report
                    </button>
                </div>
            </form>
            <div class="btn-group">
                <button onclick="window.print()" class="btn btn-outline-primary">
                    <i class="bi bi-printer"></i> Print Report
                </button>
                <button onclick="downloadPDF()" class="btn btn-outline-success">
                    <i class="bi bi-download"></i> Download PDF
                </button>
            </div>
        </div>

        <!-- रिपोर्ट सेक्शन -->
        <?php if($report_type == 'cash_flow'): ?>
        <!-- कैश फ्लो रिपोर्ट -->
        <div class="report-section">
            <h3 class="mb-4"><i class="bi bi-cash-stack text-primary"></i> Cash Flow Report</h3>
            <p class="text-muted">Period: <?= $cash_flow_report['summary']['period'] ?></p>
            
            <div class="row mb-4">
                <!-- आय -->
                <div class="col-md-6 mb-3">
                    <div class="p-3 income-box">
                        <h5 class="mb-3"><i class="bi bi-arrow-down-circle text-success"></i> Income</h5>
                        <table class="table table-hover">
                            <?php foreach($cash_flow_report['income'] as $item): ?>
                            <tr>
                                <td><?= $item['label'] ?></td>
                                <td class="text-end">
                                    <span class="amount positive">₹<?= number_format($item['amount'], 2) ?></span>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                            <tr class="table-success">
                                <td><strong>Total Income</strong></td>
                                <td class="text-end">
                                    <strong class="amount">₹<?= number_format($cash_flow_report['summary']['total_income'], 2) ?></strong>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- व्यय -->
                <div class="col-md-6 mb-3">
                    <div class="p-3 expense-box">
                        <h5 class="mb-3"><i class="bi bi-arrow-up-circle text-danger"></i> Expenses</h5>
                        <table class="table table-hover">
                            <?php foreach($cash_flow_report['expenses'] as $item): ?>
                            <tr>
                                <td><?= $item['label'] ?></td>
                                <td class="text-end">
                                    <span class="amount negative">₹<?= number_format($item['amount'], 2) ?></span>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                            <tr class="table-danger">
                                <td><strong>Total Expenses</strong></td>
                                <td class="text-end">
                                    <strong class="amount">₹<?= number_format($cash_flow_report['summary']['total_expenses'], 2) ?></strong>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- सारांश -->
            <div class="summary-card">
                <div class="row text-center">
                    <div class="col-md-4">
                        <h6>Total Income</h6>
                        <h3 class="mb-0">₹<?= number_format($cash_flow_report['summary']['total_income'], 2) ?></h3>
                    </div>
                    <div class="col-md-4">
                        <h6>Total Expenses</h6>
                        <h3 class="mb-0">₹<?= number_format($cash_flow_report['summary']['total_expenses'], 2) ?></h3>
                    </div>
                    <div class="col-md-4">
                        <h6>Net Profit/Loss</h6>
                        <h3 class="mb-0 <?= $cash_flow_report['summary']['net_profit'] >= 0 ? 'positive' : 'negative' ?>">
                            ₹<?= number_format($cash_flow_report['summary']['net_profit'], 2) ?>
                        </h3>
                    </div>
                </div>
            </div>
            
            <!-- विस्तृत जानकारी -->
            <div class="mt-4">
                <h5><i class="bi bi-info-circle"></i> Detailed Information</h5>
                <div class="row">
                    <?php foreach($cash_flow_report['income'] as $key => $item): ?>
                    <?php if(!empty($item['details'])): ?>
                    <div class="col-md-6 mb-2">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title"><?= $item['label'] ?></h6>
                                <?php foreach($item['details'] as $detail_key => $detail_value): ?>
                                <p class="card-text mb-1">
                                    <small><?= $detail_key ?>: 
                                    <?php if(is_numeric($detail_value)): ?>
                                        ₹<?= number_format($detail_value, 2) ?>
                                    <?php else: ?>
                                        <?= $detail_value ?>
                                    <?php endif; ?>
                                    </small>
                                </p>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                    <?php endif; ?>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
        
        <?php elseif($report_type == 'trading_account'): ?>
        <!-- व्यापारिक खाता -->
        <div class="report-section">
            <h3 class="mb-4"><i class="bi bi-graph-up text-primary"></i> Trading Account</h3>
            <p class="text-muted">Period: <?= $start_date ?> to <?= $end_date ?></p>
            
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <table class="table table-bordered">
                        <tr class="table-secondary">
                            <th colspan="2" class="text-center">Trading Account</th>
                        </tr>
                        <tr>
                            <td>Opening Stock</td>
                            <td class="text-end">₹<?= number_format($trading_account['opening_stock'], 2) ?></td>
                        </tr>
                        <tr>
                            <td>Purchases</td>
                            <td class="text-end">₹<?= number_format($trading_account['purchases'], 2) ?></td>
                        </tr>
                        <tr>
                            <td>Goods Available</td>
                            <td class="text-end">₹<?= number_format($trading_account['opening_stock'] + $trading_account['purchases'], 2) ?></td>
                        </tr>
                        <tr>
                            <td>Closing Stock</td>
                            <td class="text-end">₹<?= number_format($trading_account['closing_stock'], 2) ?></td>
                        </tr>
                        <tr>
                            <td>Cost of Goods Sold (COGS)</td>
                            <td class="text-end">₹<?= number_format($trading_account['opening_stock'] + $trading_account['purchases'] - $trading_account['closing_stock'], 2) ?></td>
                        </tr>
                        <tr class="table-light">
                            <td><strong>Sales</strong></td>
                            <td class="text-end"><strong>₹<?= number_format($cash_flow_report['summary']['total_income'], 2) ?></strong></td>
                        </tr>
                        <tr class="table-success">
                            <td><strong>Gross Profit</strong></td>
                            <td class="text-end">
                                <strong class="positive">₹<?= number_format($trading_account['gross_profit'], 2) ?></strong>
                            </td>
                        </tr>
                        <tr class="table-secondary">
                            <th colspan="2">Expenses</th>
                        </tr>
                        <?php foreach($trading_account['expenses'] as $label => $amount): ?>
                        <tr>
                            <td><?= $label ?></td>
                            <td class="text-end">₹<?= number_format($amount, 2) ?></td>
                        </tr>
                        <?php endforeach; ?>
                        <tr class="table-light">
                            <td><strong>Total Expenses</strong></td>
                            <td class="text-end">
                                <strong>₹<?= number_format(array_sum($trading_account['expenses']), 2) ?></strong>
                            </td>
                        </tr>
                        <tr class="table-<?= $trading_account['net_profit'] >= 0 ? 'success' : 'danger' ?>">
                            <td><strong>Net Profit/Loss</strong></td>
                            <td class="text-end">
                                <strong class="<?= $trading_account['net_profit'] >= 0 ? 'positive' : 'negative' ?>">
                                    ₹<?= number_format($trading_account['net_profit'], 2) ?>
                                </strong>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <!-- सारांश -->
            <div class="row mt-4">
                <div class="col-md-4">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h6>Gross Profit</h6>
                            <h3 class="<?= $trading_account['gross_profit'] >= 0 ? 'positive' : 'negative' ?>">
                                ₹<?= number_format($trading_account['gross_profit'], 2) ?>
                            </h3>
                            <small>Sales - Cost of Goods Sold</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h6>Total Expenses</h6>
                            <h3 class="negative">
                                ₹<?= number_format(array_sum($trading_account['expenses']), 2) ?>
                            </h3>
                            <small>Sum of all expenses</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card <?= $trading_account['net_profit'] >= 0 ? 'bg-success text-white' : 'bg-danger text-white' ?>">
                        <div class="card-body text-center">
                            <h6>Net Profit/Loss</h6>
                            <h3 class="mb-0">
                                ₹<?= number_format($trading_account['net_profit'], 2) ?>
                            </h3>
                            <small>Gross Profit - Total Expenses</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <?php elseif($report_type == 'balance_sheet'): ?>
        <!-- बैलेंस शीट -->
        <div class="report-section">
            <h3 class="mb-4"><i class="bi bi-scale text-primary"></i> Balance Sheet</h3>
            <p class="text-muted">As on: <?= $end_date ?></p>
            
            <div class="row">
                <!-- Assets -->
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header bg-success text-white">
                            <h5 class="mb-0"><i class="bi bi-wallet2"></i> Assets</h5>
                        </div>
                        <div class="card-body">
                            <table class="table">
                                <?php foreach($balance_sheet['assets'] as $asset): ?>
                                <tr>
                                    <td><?= $asset['label'] ?></td>
                                    <td class="text-end">
                                        <span class="amount positive">₹<?= number_format($asset['amount'], 2) ?></span>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                                <tr class="table-success">
                                    <td><strong>Total Assets</strong></td>
                                    <td class="text-end">
                                        <strong class="amount">₹<?= number_format($balance_sheet['total_assets'], 2) ?></strong>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- Liabilities & Equity -->
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0"><i class="bi bi-cash-coin"></i> Liabilities & Equity</h5>
                        </div>
                        <div class="card-body">
                            <h6 class="text-primary">Liabilities</h6>
                            <table class="table">
                                <?php foreach($balance_sheet['liabilities'] as $liability): ?>
                                <tr>
                                    <td><?= $liability['label'] ?></td>
                                    <td class="text-end">
                                        <span class="amount negative">₹<?= number_format($liability['amount'], 2) ?></span>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </table>
                            
                            <h6 class="text-primary mt-4">Equity</h6>
                            <table class="table">
                                <?php foreach($balance_sheet['equity'] as $equity): ?>
                                <tr>
                                    <td><?= $equity['label'] ?></td>
                                    <td class="text-end">
                                        <span class="amount <?= $equity['amount'] >= 0 ? 'positive' : 'negative' ?>">
                                            ₹<?= number_format($equity['amount'], 2) ?>
                                        </span>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                                <tr class="table-primary">
                                    <td><strong>Total Liabilities & Equity</strong></td>
                                    <td class="text-end">
                                        <strong class="amount">₹<?= number_format($balance_sheet['total_liabilities_equity'], 2) ?></strong>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- बैलेंस शीट सारांश -->
            <div class="row mt-4">
                <div class="col-md-6">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h6>Total Assets</h6>
                            <h3 class="positive">₹<?= number_format($balance_sheet['total_assets'], 2) ?></h3>
                            <small>All assets available to the company</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h6>Total Liabilities + Equity</h6>
                            <h3 class="positive">₹<?= number_format($balance_sheet['total_liabilities_equity'], 2) ?></h3>
                            <small>Assets = Liabilities + Equity</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- बैलेंस चेक -->
            <div class="alert <?= abs($balance_sheet['total_assets'] - $balance_sheet['total_liabilities_equity']) < 1 ? 'alert-success' : 'alert-danger' ?> mt-4">
                <h5><i class="bi bi-check-circle"></i> Balance Check</h5>
                <p>
                    Total Assets: ₹<?= number_format($balance_sheet['total_assets'], 2) ?><br>
                    Total Liabilities + Equity: ₹<?= number_format($balance_sheet['total_liabilities_equity'], 2) ?><br>
                    Difference: ₹<?= number_format($balance_sheet['total_assets'] - $balance_sheet['total_liabilities_equity'], 2) ?>
                </p>
                <?php if(abs($balance_sheet['total_assets'] - $balance_sheet['total_liabilities_equity']) < 1): ?>
                <p class="mb-0"><strong>✅ Balance Sheet is correct (Assets = Liabilities + Equity)</strong></p>
                <?php else: ?>
                <p class="mb-0"><strong>❌ Balance Sheet is incorrect, please resolve the difference</strong></p>
                <?php endif; ?>
            </div>
        </div>
        <?php endif; ?>
        
        <!-- फुटर -->
        <div class="text-center text-muted mt-5 no-print">
            <p>V-Tech Technologies Repair Shop © <?= date('Y') ?> | Report Generated: <?= date('d/m/Y H:i:s') ?></p>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function downloadPDF() {
            alert('To enable PDF download, please install jsPDF library');
        }
        
        // Date validation
        document.getElementById('endDate').addEventListener('change', function() {
            const startDate = new Date(document.getElementById('startDate').value);
            const endDate = new Date(this.value);
            
            if (startDate > endDate) {
                alert('End date cannot be before start date');
                this.value = document.getElementById('startDate').value;
            }
        });
    </script>
</body>
</html>