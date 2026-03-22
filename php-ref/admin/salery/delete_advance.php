<?php
require_once '../path_to_your_db_connection.php'; // Update this path

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'msg' => 'Invalid request method']);
    exit;
}

if (!isset($_POST['id']) || empty($_POST['id'])) {
    echo json_encode(['status' => 'error', 'msg' => 'Record ID is required']);
    exit;
}

$id = intval($_POST['id']);

// Delete from advance_payments table
$stmt = $conn->prepare("DELETE FROM advance_payments WHERE id = ?");
$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        echo json_encode(['status' => 'success', 'msg' => 'Record deleted successfully']);
    } else {
        echo json_encode(['status' => 'error', 'msg' => 'Record not found or already deleted']);
    }
} else {
    echo json_encode(['status' => 'error', 'msg' => 'Database error: ' . $conn->error]);
}

$stmt->close();
$conn->close();
?>