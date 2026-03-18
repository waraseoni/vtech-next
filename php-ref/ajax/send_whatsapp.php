<?php
require_once '../config.php';
if(isset($_POST['job_id'])){
    $job_id = $_POST['job_id'];
    // Yahan aap chahe to log save kar sakte ho
    // Abhi sirf success return kar rahe hain
    echo "sent";
}
?>