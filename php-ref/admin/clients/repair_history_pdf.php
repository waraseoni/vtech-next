<?php
require_once('../../config.php');  
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
?>
<!DOCTYPE html>
<html><head><title>Repair History - <?= $name ?></title>
<style>
    body{font-family:Arial;margin:40px;background:#f5f5f5}
    .container{max-width:900px;margin:auto;background:white;padding:30px;box-shadow:0 0 20px rgba(0,0,0,0.1)}
    .header{text-align:center;border-bottom:3px double #000;padding-bottom:20px}
    table{width:100%;border-collapse:collapse;margin-top:20px}
    th,td{border:1px solid #000;padding:10px}
    th{background:#f0f0f0}
    .total{font-weight:bold;font-size:18px;text-align:right;margin-top:20px}
    @media print{body{margin:0;background:white}}
</style>
</head>
<body onload="window.print()">
<div class="container">
    <div class="header">
        <h1>V-Technologies</h1>
        <p>F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur 9179105875</p>
        <h2>Repair History - <?= $name ?></h2>
        <p>Date: <?= date("d-m-Y") ?></p>
    </div>
    <table>
        <tr><th>#</th><th>Job ID</th><th>Code</th><th>Date</th><th>Item</th><th>Fault</th><th>Status</th><th>Amount</th></tr>
        <?php 
        $i=1; $total=0;
        
        // 2. Repair History (Prepared Statement)
        $stmt_repairs = $conn->prepare("SELECT * FROM transaction_list WHERE client_name = ? ORDER BY date_created DESC");
        $stmt_repairs->bind_param("i", $id);
        $stmt_repairs->execute();
        $q = $stmt_repairs->get_result();
        
        while($r=$q->fetch_assoc()){ 
            $total += $r['amount'];
            
            // Status logic
            $status_text = '';
            switch($r['status']){
                case 0: $status_text = 'Pending'; break;
                case 1: $status_text = 'In Progress'; break;
                case 2: $status_text = 'Done'; break;
                case 3: $status_text = 'Paid'; break;
                case 5: $status_text = 'Delivered'; break;
                case 4: $status_text = 'Cancelled'; break;
                default: $status_text = 'Unknown';
            }
        ?>
        <tr>
            <td><?= $i++ ?></td>
			<td><?= $r['job_id'] ?></td>
            <td><?= $r['code'] ?></td>
            <td><?= date("d-m-Y",strtotime($r['date_created'])) ?></td>
            <td><?= $r['item'] ?></td>
            <td><?= ucwords($r['fault']) ?></td>
            <td><?= $status_text ?></td>
            <td align="right">₹<?= number_format($r['amount']) ?></td>
        </tr>
        <?php }
        $stmt_repairs->close();
        
        if($i == 1): // Agar koi entry nahi mili
        ?>
        <tr>
            <td colspan="8" style="text-align:center;">No repair records found for this client.</td>
        </tr>
        <?php endif; ?>
    </table>
    
    <div class="total">Total Repair Amount: ₹<?= number_format($total) ?></div>
	<div class="text-center" style="margin-top:50px;">
        <p><b>Thank You! Visit Again</b><br>V-Technologies</p>
        <p class="no-print"><button onclick="window.close()" class="btn btn-secondary">Close</button></p>
    </div>
</div>
</body>
</html>