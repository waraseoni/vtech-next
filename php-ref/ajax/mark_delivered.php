<?php
require_once '../config.php';   // ya jo bhi aapka connection file hai

if(isset($_POST['id'])) {
    $id = $_POST['id'];
    
    // Status 5 kar do + delivery date daal do
    $conn->query("UPDATE transaction_list SET status = 5, date_delivery = NOW() WHERE id = '$id'");
    
    // Optional: Yahan bill PDF bhi auto generate kar sakte hain
    echo "success";
}
?>