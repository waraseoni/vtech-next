<?php
require_once('../../config.php'); 
if(!isset($_GET['id']) || !is_numeric($_GET['id'])){
    die("Error: Client ID is missing or invalid.");
}
$id = $_GET['id'];

// 1. Client Details (Fetch Opening Balance also)
$stmt_client = $conn->prepare("SELECT * FROM client_list WHERE id = ?");
$stmt_client->bind_param("i", $id);
$stmt_client->execute();
$client = $stmt_client->get_result()->fetch_assoc();
$stmt_client->close();

if(!$client) {
    die("Error: Client not found.");
}

$name = trim($client['firstname'].' '.($client['middlename'] ? $client['middlename'].' ': '').$client['lastname']);
$opening_balance = (float)$client['opening_balance'];

// 2. Total Billed (status = 5: Delivered)
$stmt_billed = $conn->prepare("SELECT SUM(amount) as t FROM transaction_list WHERE client_name = ? AND status = 5");
$stmt_billed->bind_param("i", $id);
$stmt_billed->execute();
$total_billed = $stmt_billed->get_result()->fetch_assoc()['t'] ?? 0;
$stmt_billed->close();

// 3. Total Paid (Matching logic with view_client.php: amount + discount)
$stmt_paid = $conn->prepare("SELECT SUM(amount + discount) as p FROM client_payments WHERE client_id = ?");
$stmt_paid->bind_param("i", $id);
$stmt_paid->execute();
$total_paid = $stmt_paid->get_result()->fetch_assoc()['p'] ?? 0;
$stmt_paid->close();

// 4. Final Balance Calculation
$final_balance = ($opening_balance + $total_billed) - $total_paid;
?>
<!DOCTYPE html>
<html><head><title>Payment Ledger - <?= $name ?></title>
<style>
    body{font-family:Arial;margin:40px;background:#f5f5f5;font-size:14px;}
    .container{max-width:900px;margin:auto;background:white;padding:30px;box-shadow:0 0 20px rgba(0,0,0,0.1)}
    .header{text-align:center;border-bottom:3px double #000;padding-bottom:20px}
    table{width:100%;border-collapse:collapse;margin-top:20px}
    th,td{border:1px solid #000;padding:10px;text-align:left}
    th{background:#f0f0f0}
    .total-wrapper{width:100%;margin-top:20px;display: flex;justify-content: flex-end;}
    .total{width:350px;border:2px solid #000}
    .total td{border:none;padding:5px 10px;}
    .total tr.grand-total{border-top:2px solid #000; background:#eee}
    .text-right{text-align:right}
    .mt-4{margin-top:20px}
    @media print{body{margin:0;background:white}.no-print{display:none}}
</style>
</head>
<body onload="window.print()">
<div class="container">
    <div class="header">
        <h1>V-Technologies</h1>
        <p>F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur 9179105875</p>
        <h2>Payment Ledger - <?= $name ?></h2>
        <p>Date: <?= date("d-m-Y") ?></p>
    </div>

    <h3>Account Summary</h3>
    <div class="total-wrapper">
        <table class="total">
            <tr><td>Opening Balance</td><td class="text-right">₹<?= number_format($opening_balance, 2) ?></td></tr>
            <tr><td>Total Billed (Delivered)</td><td class="text-right">₹<?= number_format($total_billed, 2) ?></td></tr>
            <tr><td>Total Received (Net)</td><td class="text-right">₹<?= number_format($total_paid, 2) ?></td></tr>
            <tr class="grand-total" style="background:<?= $final_balance > 0 ? '#ffeb3b' : '#c8e6c9' ?>">
                <td><b><?= $final_balance >= 0 ? 'Total Due Balance' : 'Advance Amount' ?></b></td>
                <td class="text-right"><b>₹<?= number_format(abs($final_balance), 2) ?></b></td>
            </tr>
        </table>
    </div>

    <h3 class="mt-4">Transaction Details</h3>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Ref. ID / Bill</th>
                <th>Amount</th>
                <th>Discount</th>
                <th>Net Paid</th>
                <th>Mode</th>
                <th>Remarks</th>
            </tr>
        </thead>
        <tbody>
            <?php 
            $stmt_payments = $conn->prepare("SELECT * FROM client_payments WHERE client_id = ? ORDER BY payment_date DESC");
            $stmt_payments->bind_param("i", $id);
            $stmt_payments->execute();
            $q = $stmt_payments->get_result();
            if($q->num_rows > 0):
                while($r=$q->fetch_assoc()): ?>
                <tr>
                    <td><?= date("d-m-Y",strtotime($r['payment_date'])) ?></td>
                    <td><?= $r['job_id'] ?: ($r['bill_no'] ?: 'Direct') ?></td>
                    <td>₹<?= number_format($r['amount'], 2) ?></td>
                    <td>₹<?= number_format($r['discount'], 2) ?></td>
                    <td><b>₹<?= number_format($r['amount'] + $r['discount'], 2) ?></b></td>
                    <td><?= $r['payment_mode'] ?></td>
                    <td><?= $r['remarks'] ?: '—' ?></td>
                </tr>
                <?php endwhile; 
            else: ?>
                <tr><td colspan="7" style="text-align:center">No payment history found.</td></tr>
            <?php endif;
            $stmt_payments->close(); ?>
        </tbody>
    </table>

    <div style="margin-top:50px; text-align:center;">
        <p><b>Thank You! Visit Again</b><br>V-Technologies</p>
        <p class="no-print"><button onclick="window.close()" style="cursor:pointer;padding:5px 15px">Close</button></p>
    </div>
</div>
</body>
</html>