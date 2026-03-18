<?php
require_once '../config.php';  // ya jo bhi aapka connection file hai

$job_id = $_GET['job_id'] ?? '';
if(empty($job_id)) die('Invalid');

$qry = $conn->query("SELECT t.*, c.firstname, c.middlename, c.lastname, c.contact 
                     FROM transaction_list t 
                     LEFT JOIN client_list c ON t.client_name = c.id 
                     WHERE t.job_id = '$job_id'");
$row = $qry->fetch_assoc();

$name = trim($row['firstname'].' '.$row['middlename'].' '.$row['lastname']);

// Simple HTML bill
$html = '
<h2 style="text-align:center;color:#2c3e50;">VIKRAM ELECTRONICS & REPAIR</h2>
<p style="text-align:center;">Wright Town, Jabalpur │ 9179105875</p>
<hr>
<h3>Bill – '.$job_id.'</h3>
<p><b>Customer:</b> '.$name.'<br>
   <b>Contact:</b> '.$row['contact'].'<br>
   <b>Item:</b> '.$row['item'].'<br>
   <b>Fault:</b> '.$row['fault'].'</p>
<hr>
<h2 style="text-align:right;color:green;">Total: ₹'.number_format($row['amount']).'</h2>
<p style="text-align:center;">धन्यवाद! पुनः मिलेंगे 😊</p>';

// HTML ko image (base64) mein convert karo
require_once '../inc/html2canvas.php';   // agla step mein bana denge
$image = html_to_image($html);

$filename = "Bill_".$job_id.".png";
$filepath = "../uploads/bills/".$filename;
file_put_contents($filepath, $image);

// Direct URL return karo
echo $filepath;  // WhatsApp mein attach karne ke liye
?>