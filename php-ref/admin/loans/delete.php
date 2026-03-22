<?php
require_once('../config.php');
$id = intval($_GET['id'] ?? 0);
if($id){
    $conn->query("DELETE FROM client_loans WHERE id = $id");
    // Also delete related payments? Or keep them? We'll keep payments but set loan_id to NULL
    $conn->query("UPDATE client_payments SET loan_id = NULL WHERE loan_id = $id");
}
header("Location: index.php");
exit;