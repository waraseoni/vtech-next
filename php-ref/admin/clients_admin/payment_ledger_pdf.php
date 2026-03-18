<?php require_once $_SERVER['DOCUMENT_ROOT'] . '/vtech-rsms/config.php'; ?>
<?php 
if(!isset($_GET['id']) || !is_numeric($_GET['id'])){
    // ID missing hone par error message
    die("Error: Client ID is missing or invalid.");
}
$id = $_GET['id'];

// 1. Client Details (Prepared Statement)
$stmt_client = $conn->prepare("SELECT * FROM client_list WHERE id = ?");
$stmt_client->bind_param("i", $id);
$stmt_client->execute();
$client = $stmt_client->get_result()->fetch_assoc();
$stmt_client->close();
if(!$client) {
    die("Error: Client not found.");
}
$name = trim($client['firstname'].' '.($client['middlename'] ? $client['middlename'].' ': '').$client['lastname']);

// 2. Total Billed (status = 5: Delivered) (Prepared Statement)
$stmt_billed = $conn->prepare("SELECT SUM(amount) as t FROM transaction_list WHERE client_name = ? AND status = 5");
$stmt_billed->bind_param("i", $id);
$stmt_billed->execute();
$total_billed = $stmt_billed->get_result()->fetch_assoc()['t'] ?? 0;
$stmt_billed->close();

// 3. Total Paid (Prepared Statement)
$stmt_paid = $conn->prepare("SELECT SUM(amount - discount) as p FROM client_payments WHERE client_id = ?");
$stmt_paid->bind_param("i", $id);
$stmt_paid->execute();
$total_paid = $stmt_paid->get_result()->fetch_assoc()['p'] ?? 0;
$stmt_paid->close();

$balance = $total_billed - $total_paid;
?>
<!DOCTYPE html>
<html><head><title>Payment Ledger - <?= $name ?></title>
<style>
    body{font-family:Arial;margin:40px;background:#f5f5f5}
    .container{max-width:900px;margin:auto;background:white;padding:30px;box-shadow:0 0 20px rgba(0,0,0,0.1)}
    .header{text-align:center;border-bottom:3px double #000;padding-bottom:20px}
    table{width:100%;border-collapse:collapse;margin-top:20px}
    th,td{border:1px solid #000;padding:10px}
    th{background:#f0f0f0}
    .total{width:350px;float:right;border:2px solid #000} /* Added width to total table */
    .total td{border:none;padding:5px 10px;}
    .total tr:last-child td{border-top:2px solid #000;}
    h3.mt-4 {clear:both;} /* Clear float for h3 */
    @media print{body{margin:0;background:white}}
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

    <h3>Summary</h3>
    <table class="total">
        <tr><td>Total Bill Amount</td><td align="right">₹<?= number_format($total_billed) ?></td></tr>
        <tr><td>Total Received</td><td align="right">₹<?= number_format($total_paid) ?></td></tr>
        <tr style="background:#ffc107"><td><b>Balance <?= $balance>0?'Due':'Settled' ?></b></td><td align="right"><b>₹<?= number_format(abs($balance)) ?></b></td></tr>
    </table>

    <h3 class="mt-4">Payment Details</h3>
    <table>
        <tr><th>Date</th><th>Bill No.</th><th>Job ID</th><th>Amount</th><th>Discount</th><th>Net</th><th>Mode</th><th>Type</th><th>Remarks</th></tr>
        <?php 
        // 4. Payment History (Prepared Statement)
        $stmt_payments = $conn->prepare("SELECT * FROM client_payments WHERE client_id = ? ORDER BY payment_date DESC");
        $stmt_payments->bind_param("i", $id);
        $stmt_payments->execute();
        $q = $stmt_payments->get_result();
        while($r=$q->fetch_assoc()): ?>
        <tr>
            <td><?= date("d-m-Y",strtotime($r['payment_date'])) ?></td>
            <td><?= $r['bill_no']?:'—' ?></td> <td><?= $r['job_id']?:'—' ?></td>
            <td>₹<?= number_format($r['amount']) ?></td>
            <td>₹<?= number_format($r['discount']) ?></td>
            <td><b>₹<?= number_format($r['amount'] - $r['discount']) ?></b></td>
            <td><?= $r['payment_mode'] ?></td>
            <td><?= $r['payment_type'] ?></td>
            <td><?= $r['remarks']?:'—' ?></td>
        </tr>
        <?php endwhile;
        $stmt_payments->close(); ?>
    </table>
</div>
</body>
</html>