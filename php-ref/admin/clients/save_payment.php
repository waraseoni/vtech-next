<?php
// File location: admin/clients/save_payment.php
require_once '../../config.php'; 

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    // Direct access ko rokein
    header("Location: ../index.php?page=clients");
    exit;
}

if (isset($_POST)) {
    // Values ko set karein
    $payment_id = $_POST['id'] ?? null; 
    $client_id = $_POST['client_id'];
    $job_id = $_POST['job_id'] ?: null;
    $bill_no = $_POST['bill_no'] ?: null;
    $amount = $_POST['amount'];
    $discount = $_POST['discount'] ?: 0;
    $mode = $_POST['payment_mode'];
    $type = $_POST['payment_type'];
    $remarks = $_POST['remarks'] ?: '';
	$payment_date = $_POST['payment_date'] ?? date('Y-m-d');

    // Data type: i=integer, d=double, s=string.
    // 'd' (double/float) amount aur discount ke liye zaroori hai.

    if (empty($payment_id)) {
        // --- INSERT (Naya Payment) ---
        $stmt = $conn->prepare("INSERT INTO client_payments 
                        (client_id, job_id, bill_no, amount, discount, payment_mode, payment_type, remarks, payment_date) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        // Parameter binding: id, job_id, bill_no integers/strings hain, amount/discount doubles hain.
        // Agar client_id bhi integer hai, to pehla 'i' hoga. Maine yahan sabko 's' (string) mana hai.
        $stmt->bind_param("isddsssss", $client_id, $job_id, $bill_no, $amount, $discount, $mode, $type, $remarks, $payment_date);
        
    } else {
        // --- UPDATE (Edit Payment) ---
        $stmt = $conn->prepare("UPDATE client_payments SET 
                        job_id = ?, 
                        bill_no = ?, 
                        amount = ?, 
                        discount = ?, 
                        payment_mode = ?, 
                        payment_type = ?, 
                        remarks = ?,
                        payment_date = ?
                        WHERE id = ?");

        // Parameter binding: pehle 7 fields strings/doubles, aakhiri ID integer.
        $stmt->bind_param("ssddssssi", $job_id, $bill_no, $amount, $discount, $mode, $type, $remarks, $payment_date, $payment_id);
    }

    if ($stmt->execute()) {
        // Success → wapas client view page pe le jao
        header("Location: ../index.php?page=clients/view_client&id=$client_id"); 
        exit;
    } else {
        die("Database Error: " . $stmt->error);
    }
    
    $stmt->close();

} else {
    // Agar post data missing ho
    header("Location: ../index.php?page=clients");
    exit;
}
?>