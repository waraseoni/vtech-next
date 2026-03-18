<div style="text-align:center;">
    <img src="../assets/img/logo.png" width="100"><br><br>
    <h1>VIKRAM ELECTRONICS & REPAIR</h1>
    <p>Wright Town, Jabalpur | 9179105875</p>
</div>
<?php
require_once '../config.php';
if(!isset($_GET['job_id'])) exit;

$job_id = $_GET['job_id'];
$qry = $conn->query("SELECT t.*, c.firstname, c.middlename, c.lastname, c.contact 
                     FROM transaction_list t 
                     LEFT JOIN client_list c ON t.client_name = c.id 
                     WHERE t.job_id = '$job_id'");
$res = $qry->fetch_array();

require_once('../vendor/autoload.php'); // TCPDF ya mPDF install karna padega (baad mein bataunga)

use Mpdf\Mpdf;

$mpdf = new Mpdf([
    'mode' => 'utf-8',
    'format' => 'A4',
    'margin_left' => 15,
    'margin_right' => 15,
    'margin_top' => 20,
    'margin_bottom' => 20
]);

$html = '
<h2 style="text-align:center; color:#2c3e50;">VIKRAM ELECTRONICS & REPAIR</h2>
<p style="text-align:center;">Wright Town, Jabalpur | Call: 9179105875</p>
<hr>
<h3>Repair Bill - Job ID: '.$res['job_id'].'</h3>
<table width="100%" cellpadding="5">
<tr><td><b>Client:</b> '.$res['firstname'].' '.$res['lastname'].'</td><td><b>Date:</b> '.date("d/m/Y", strtotime($res['date_delivery'] ? $res['date_delivery'] : $res['date_created'])).'</td></tr>
<tr><td><b>Contact:</b> '.$res['contact'].'</td><td><b>Item:</b> '.$res['item'].'</td></tr>
<tr><td><b>Fault:</b> '.$res['fault'].'</td><td><b>Status:</b> Delivered</td></tr>
</table>
<br>
<table width="100%" border="1" cellpadding="8" cellspacing="0">
<tr style="background:#f0f0f0;"><th>Part / Service</th><th>Amount</th></tr>
';

// Parts + Services add karo (simple way)
$total = $res['amount'];
$html .= '<tr><td colspan="2" style="text-align:right;"><b>Total Amount: ₹'.$total.'</b></td></tr>
</table>
<br><br>
<p style="text-align:center;">Thank you! Visit Again 😊</p>
<p style="text-align:center; font-size:11px;">Powered by Vikram Repair System</p>
';

$mpdf->WriteHTML($html);
$filename = "Vikram_Bill_".$job_id.".pdf";
$filepath = "../uploads/bills/".$filename;
$mpdf->Output($filepath, 'F');

// Agar print=1 hai to direct download
if(isset($_GET['print'])){
    $mpdf->Output($filename, 'D');
    exit;
}

echo $filename." generated!";
?>