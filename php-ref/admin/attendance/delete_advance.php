<?php
// Database connection check karein (Path sahi hona chahiye)
require_once('../../config.php'); 

header('Content-Type: application/json');

$resp = array();

if(isset($_POST['id'])){
    $id = $_POST['id'];
    
    // Query run karein
    $delete = $conn->query("DELETE FROM `advance_payments` WHERE id = '{$id}'");
    
    if($delete){
        $resp['status'] = 'success';
        $resp['msg'] = "Record successfully deleted.";
    } else {
        $resp['status'] = 'failed';
        $resp['error'] = $conn->error;
        $resp['msg'] = "Database error: " . $conn->error;
    }
} else {
    $resp['status'] = 'failed';
    $resp['msg'] = "No ID provided.";
}

echo json_encode($resp);
exit;