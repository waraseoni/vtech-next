<?php
// Config file include karein
// File location: admin/clients/delete_payment.php
require_once $_SERVER['DOCUMENT_ROOT'] . '/vtech-rsms/config.php';

if(isset($_GET['id']) && is_numeric($_GET['id'])){
    $payment_id = $_GET['id'];
    
    // Payment ID ke through Client ID nikal lein
    $stmt_get_client = $conn->prepare("SELECT client_id FROM `client_payments` WHERE id = ?");
    $stmt_get_client->bind_param("i", $payment_id);
    $stmt_get_client->execute();
    $result_client = $stmt_get_client->get_result();
    
    if($result_client->num_rows > 0){
        $client_row = $result_client->fetch_assoc();
        $client_id = $client_row['client_id'];
        
        // Step 1: Query prepare karein DELETE ke liye
        $stmt_delete = $conn->prepare("DELETE FROM `client_payments` WHERE id = ?");
        
        // Step 2: Parameter bind karein
        $stmt_delete->bind_param("i", $payment_id);
        
        // Step 3: Query execute karein
        if($stmt_delete->execute()){
            // Successfully deleted
            
            // Delete ke baad, user ko usi page par wapas bhej dein jahan se woh aaya tha.
            // Agar referer available nahi hai, to client view page par redirect karein.
            $redirect_url = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '../index.php?page=clients/view_client&id='.$client_id;
            echo '<script> alert("Payment record successfully deleted."); location.replace("'.$redirect_url.'"); </script>';
            
            exit;
        } else {
            // Error occurred
            $redirect_url = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '../index.php?page=clients/view_client&id='.$client_id;
            echo '<script> alert("Payment record delete karne mein error aayi: ' . $conn->error . '\nQuery: ' . $stmt_delete->error . '"); location.replace("'.$redirect_url.'"); </script>';
            exit;
        }
        $stmt_delete->close();
    } else {
        // Payment ID nahi mili
        echo '<script> alert("Unknown Payment ID."); location.replace("../index.php?page=clients"); </script>';
        exit;
    }
    $stmt_get_client->close();
    
} else {
    // ID provide nahi ki gayi
    echo '<script> alert("Payment ID is required for deletion."); location.replace("../index.php?page=clients"); </script>';
    exit;
}
?>