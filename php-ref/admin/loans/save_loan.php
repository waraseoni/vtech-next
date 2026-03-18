<?php
require_once('../config.php');
session_start();

$id = intval($_POST['id'] ?? 0);
$client_id = intval($_POST['client_id']);
$loan_date = $_POST['loan_date'];
$total_payable = floatval($_POST['total_payable']);
$emi_amount = floatval($_POST['emi_amount']);
$remarks = $conn->real_escape_string($_POST['remarks'] ?? '');
$status = intval($_POST['status']);

if($client_id <= 0 || empty($loan_date) || $total_payable <= 0){
    echo "<script>alert('Invalid input'); window.history.back();</script>";
    exit;
}

if($id > 0){
    $sql = "UPDATE client_loans SET client_id='$client_id', loan_date='$loan_date', total_payable='$total_payable', emi_amount='$emi_amount', remarks='$remarks', status='$status' WHERE id='$id'";
} else {
    $sql = "INSERT INTO client_loans (client_id, loan_date, total_payable, emi_amount, remarks, status) VALUES ('$client_id', '$loan_date', '$total_payable', '$emi_amount', '$remarks', '$status')";
}

if($conn->query($sql)){
    echo "<script>alert('Loan saved successfully'); location.replace('index.php?client_id=$client_id');</script>";
} else {
    echo "<script>alert('Error: ".$conn->error."'); window.history.back();</script>";
}
?>