<?php
require_once '../config.php';

$count = 0;
$qry = $conn->query("SELECT SUM(quantity) as total, product_id FROM inventory_list GROUP BY product_id HAVING total <= 5");
while($row = $qry->fetch_assoc()){
    $count++;
}
echo $count;
?>