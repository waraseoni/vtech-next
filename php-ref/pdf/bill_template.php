<?php
require_once '../config.php';  // ya config.php — jo bhi aapka connection hai

if(!isset($_GET['job_id'])) {
    die("Job ID missing!");
	}
$job_id = $_GET['job_id'];
$qry = $conn->query("SELECT t.*, c.firstname, c.middlename, c.lastname, c.contact, c.address 
                     FROM transaction_list t 
                     LEFT JOIN client_list c ON t.client_name = c.id 
                     WHERE t.job_id = '$job_id'");

if($qry->num_rows == 0) {
    die("Job not found!");
}
$row = $qry->fetch_assoc();

$name = trim($row['firstname'].' '.$row['middlename'].' '.$row['lastname']);
$date = $row['date_updated'] ? date("d-m-Y", strtotime($row['date_updated'])) : date("d-m-Y", strtotime($row['date_created']));
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bill - <?php echo $job_id; ?></title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f4f4f6; }
        .bill-container { max-width: 800px; margin: auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header img { width: 100px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #333; padding: 12px; text-align: left; }
        th { background: #f0f0f0; }
        .total { font-size: 28px; font-weight: bold; color: #28a745; text-align: right; }
        .text-center { text-align: center; }
        .footer { margin-top: 50px; text-align: center; font-size: 14px; color: #555; }
        @media print {
            body { background: white; margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body onload="window.print()">

<div class="bill-container">
    <div class="header">
        <!-- Agar logo hai to daal do, warna comment kar do -->
        <img src="../uploads/logo.png" alt="Logo">
        <h2>V-Technologies</h2>
        <p>F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur  9179105875</p>
        <hr>
        <h2>REPAIR BILL</h2>
        <h3>Job ID: <?php echo $job_id; ?></h3>		
    </div>

    <table>
		<tr><th>Code</th><td><?php echo $row['code']; ?></td></tr>
        <tr><th>Customer Name</th><td><?php echo $name; ?></td></tr>
        <tr><th>Contact</th><td><?php echo $row['contact']; ?></td></tr>
        <tr><th>Address</th><td><?php echo $row['address'] ?: '—'; ?></td></tr>
        <tr><th>Item</th><td><?php echo $row['item']; ?></td></tr>
        <tr><th>Fault</th><td><?php echo $row['fault']; ?></td></tr>
        <tr><th>Delivery Date</th><td><?php echo $date; ?></td></tr>
    </table>

    <table>
        <tr>
            <th>Description</th>
            <th style="text-align:right;">Amount</th>
        </tr>
        <tr>
            <td>Repair Charges + Parts Used</td>
            <td style="text-align:right; font-size:22px; color:#28a745;">
                ₹<?php echo number_format($row['amount']); ?>
            </td>
        </tr>
    </table>

    <div class="total">
        Total Amount: ₹<?php echo number_format($row['amount']); ?>
    </div>

    <div class="footer">
        <p><strong>धन्यवाद! आपका भरोसा ही हमारी पूंजी है</strong></p>
        <p>Powered by Vikram Repair System</p>
    </div>
</div>

<div class="no-print text-center" style="margin-top:30px;">
    <button onclick="window.print()" class="btn btn-success" style="padding:10px 20px; font-size:16px;">Print Again</button>
    <button onclick="window.close()" class="btn btn-secondary" style="padding:10px 20px; font-size:16px;">Close</button>
</div>

</body>
</html>