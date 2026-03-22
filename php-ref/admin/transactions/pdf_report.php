<?php
// यह एक सरल PDF report है
$date_from = isset($_GET['date_from']) ? $_GET['date_from'] : '';
$date_to = isset($_GET['date_to']) ? $_GET['date_to'] : '';

$where_cond = "";
if(!empty($date_from) && !empty($date_to)){
    $where_cond = " WHERE date(t.date_created) BETWEEN '{$date_from}' AND '{$date_to}' ";
}

$qry = $conn->query("SELECT t.*, c.firstname, c.middlename, c.lastname, c.contact, t.code 
                     FROM `transaction_list` t 
                     INNER JOIN client_list c ON t.client_name = c.id 
                     {$where_cond} 
                     ORDER BY unix_timestamp(t.date_created) DESC");
?>
<!DOCTYPE html>
<html>
<head>
    <title>Transaction PDF Report</title>
    <style>
        body { font-family: Arial, sans-serif; }
        h2 { color: #001f3f; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #001f3f; color: white; }
    </style>
</head>
<body>
    <h2>Transaction Report</h2>
    <p><strong>Date:</strong> <?= date("d M Y") ?></p>
    <?php if(!empty($date_from) && !empty($date_to)): ?>
    <p><strong>Period:</strong> <?= $date_from ?> to <?= $date_to ?></p>
    <?php endif; ?>
    
    <table>
        <tr>
            <th>#</th>
            <th>Date</th>
            <th>Job No.</th>
            <th>Client</th>
            <th>Item</th>
            <th>Amount</th>
            <th>Status</th>
        </tr>
        <?php 
        $i = 1;
        while($row = $qry->fetch_assoc()):
            $fullname = trim($row['firstname'] . ' ' . $row['middlename'] . ' ' . $row['lastname']);
            $status_text = '';
            switch($row['status']){
                case 0: $status_text = 'Pending'; break;
                case 1: $status_text = 'On-Progress'; break;
                case 2: $status_text = 'Done'; break;
                case 3: $status_text = 'Paid'; break;
                case 4: $status_text = 'Cancelled'; break;
                case 5: $status_text = 'Delivered'; break;
            }
        ?>
        <tr>
            <td><?= $i++ ?></td>
            <td><?= date("d M Y", strtotime($row['date_created'])) ?></td>
            <td><?= $row['job_id'] ?></td>
            <td><?= $fullname ?></td>
            <td><?= $row['item'] ?></td>
            <td>₹<?= number_format($row['amount'], 2) ?></td>
            <td><?= $status_text ?></td>
        </tr>
        <?php endwhile; ?>
    </table>
    
    <script>
        window.onload = function() {
            window.print();
        }
    </script>
</body>
</html>