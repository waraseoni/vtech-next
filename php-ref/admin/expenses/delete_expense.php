<?php
require_once('../../config.php'); 

header('Content-Type: application/json');

$resp = array();

if(isset($_POST['id'])){
    $id = $_POST['id'];
    
    $delete = $conn->query("DELETE FROM `expense_list` WHERE id = '{$id}'");
    
    if($delete){
        $resp['status'] = 'success';
        $resp['msg'] = "Expense record deleted.";
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