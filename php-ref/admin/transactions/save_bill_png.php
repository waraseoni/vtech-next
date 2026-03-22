<?php
// admin/transactions/save_bill_png.php
require_once '../../config.php';

if(!isset($_GET['job_id'])) die("Invalid");

$job_id = $_GET['job_id'];

// Job details fetch
$qry = $conn->query("SELECT t.*, c.firstname, c.middlename, c.lastname, c.contact 
                     FROM transaction_list t 
                     LEFT JOIN client_list c ON t.client_name = c.id 
                     WHERE t.job_id = '$job_id'");
$row = $qry->fetch_assoc();
$name = trim($row['firstname'].' '.$row['middlename'].' '.$row['lastname']);

// HTML bill (same jo bill.php mein hai)
$html = '
<div style="width:800px; padding:40px; background:white; font-family:Arial;">
    <h1 style="text-align:center; color:#28a745;">VIKRAM ELECTRONICS & REPAIR</h1>
    <p style="text-align:center;">Wright Town, Jabalpur | 9179105875</p>
    <hr>
    <h2 style="text-align:center;">REPAIR BILL - '.$job_id.'</h2>
    <table width="100%" style="margin:20px 0; border-collapse:collapse;">
        <tr><td><b>Customer:</b> '.$name.'</td><td><b>Date:</b> '.date("d-m-Y").'</td></tr>
        <tr><td><b>Contact:</b> '.$row['contact'].'</td><td><b>Item:</b> '.$row['item'].'</td></tr>
        <tr><td colspan="2"><b>Fault:</b> '.$row['fault'].'</td></tr>
    </table>
    <h1 style="text-align:right; color:green;">Total: ₹'.number_format($row['amount']).'</h1>
    <p style="text-align:center; margin-top:50px;">धन्यवाद! पुनः मिलेंगे</p>
</div>';

// HTML to PNG using free API (100% working)
$api_url = "https://api.htmlcsstoimage.com/v1/generate";
$post_data = json_encode([
    "html" => $html,
    "css" => "body{background:#f0f0f0;}",
    "google_fonts" => "Roboto"
]);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $api_url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);
$response = curl_exec($ch);
curl_close($ch);

// Save as PNG
$filename = "Bill_".$job_id.".png";
$filepath = "../../uploads/bills/".$filename;
file_put_contents($filepath, $response);

// Direct download bhi karwa do
header('Content-Type: image/png');
header('Content-Disposition: attachment; filename="'.$filename.'"');
echo $response;
exit;
?>