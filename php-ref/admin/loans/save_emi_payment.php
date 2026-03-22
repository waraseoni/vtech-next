<?php
// loans/save_emi_payment.php - AJAX endpoint for EMI payments
require_once(__DIR__ . '/../../config.php');

header('Content-Type: application/json');
$response = ['status' => 'error', 'msg' => ''];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['msg'] = 'Invalid request method.';
    echo json_encode($response);
    exit;
}

$loan_id = intval($_POST['loan_id'] ?? 0);
$client_id = intval($_POST['client_id'] ?? 0);
$amount = floatval($_POST['amount'] ?? 0);
$discount = floatval($_POST['discount'] ?? 0);
$payment_date = $_POST['payment_date'] ?? '';
$payment_mode = $_POST['payment_mode'] ?? '';
$remarks = $conn->real_escape_string($_POST['remarks'] ?? '');

if (!$loan_id || !$client_id || $amount <= 0 || !$payment_date || !$payment_mode) {
    $response['msg'] = 'All required fields must be filled.';
    echo json_encode($response);
    exit;
}

// Insert into client_payments
$stmt = $conn->prepare("INSERT INTO client_payments (client_id, loan_id, amount, discount, payment_date, payment_mode, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("iiddsss", $client_id, $loan_id, $amount, $discount, $payment_date, $payment_mode, $remarks);

if ($stmt->execute()) {
    $response['status'] = 'success';
    $response['msg'] = 'EMI payment recorded.';
} else {
    $response['msg'] = 'Database error: ' . $stmt->error;
}
$stmt->close();
// $conn->close();  // यह लाइन हटाई गई

echo json_encode($response);
exit;
?>