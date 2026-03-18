<?php
// loans/close.php - Close a loan (AJAX endpoint)
require_once(__DIR__ . '/../../config.php');

header('Content-Type: application/json');
$response = ['status' => 'error', 'msg' => ''];

// Only POST requests allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['msg'] = 'Invalid request method.';
    echo json_encode($response);
    exit;
}

$id = isset($_POST['id']) ? intval($_POST['id']) : 0;
if ($id <= 0) {
    $response['msg'] = 'Invalid loan ID.';
    echo json_encode($response);
    exit;
}

// Use prepared statement to prevent SQL injection
$stmt = $conn->prepare("UPDATE client_loans SET status = 0 WHERE id = ?");
if (!$stmt) {
    $response['msg'] = 'Database error: ' . $conn->error;
    echo json_encode($response);
    exit;
}

$stmt->bind_param("i", $id);
if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        $response['status'] = 'success';
        $response['msg'] = 'Loan closed successfully.';
    } else {
        $response['msg'] = 'Loan not found or already closed.';
    }
} else {
    $response['msg'] = 'Execution error: ' . $stmt->error;
}
$stmt->close();
$conn->close();

echo json_encode($response);
exit;
?>