<?php
// loans/delete_payment.php - Delete an EMI payment
require_once(__DIR__ . '/../../config.php');

header('Content-Type: application/json');
$response = ['status' => 'error', 'msg' => ''];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['msg'] = 'Invalid request method.';
    echo json_encode($response);
    exit;
}

$id = intval($_POST['id'] ?? 0);
if (!$id) {
    $response['msg'] = 'Invalid payment ID.';
    echo json_encode($response);
    exit;
}

$stmt = $conn->prepare("DELETE FROM client_payments WHERE id = ?");
$stmt->bind_param("i", $id);
if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        $response['status'] = 'success';
        $response['msg'] = 'Payment deleted.';
    } else {
        $response['msg'] = 'Payment not found.';
    }
} else {
    $response['msg'] = 'Database error: ' . $stmt->error;
}
$stmt->close();
$conn->close();

echo json_encode($response);
exit;