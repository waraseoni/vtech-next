<?php
// loans/get_payment.php - Fetch payment details for editing
require_once(__DIR__ . '/../../config.php');

header('Content-Type: application/json');
$response = ['status' => 'error', 'msg' => ''];

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if (!$id) {
    $response['msg'] = 'Invalid payment ID.';
    echo json_encode($response);
    exit;
}

$stmt = $conn->prepare("SELECT * FROM client_payments WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();
if ($row = $result->fetch_assoc()) {
    $response['status'] = 'success';
    $response['data'] = $row;
} else {
    $response['msg'] = 'Payment not found.';
}
$stmt->close();
$conn->close();

echo json_encode($response);
exit; // कोई extra whitespace नहीं होना चाहिए