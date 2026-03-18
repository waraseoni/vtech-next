<?php
//header("Content-Type: application/vnd.ms-excel");
//header("Content-Disposition: attachment; filename=transaction_report_" . date("Y-m-d") . ".xls");

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
    <meta charset="UTF-8">
    <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #001f3f; color: white; font-weight: bold; }
    </style>
</head>
<body>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Date & Time</th>
                <th>Job No.</th>
                <th>Code</th>
                <th>Client Name</th>
                <th>Contact</th>
                <th>Item/Model</th>
                <th>Fault</th>
                <th>Locate</th>
                <th>Amount (₹)</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
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
                <td><?= date("d M Y, h:i A", strtotime($row['date_created'])) ?></td>
                <td><?= $row['job_id'] ?></td>
                <td><?= !empty($row['code']) ? $row['code'] : 'No Code' ?></td>
                <td><?= $fullname ?></td>
                <td><?= $row['contact'] ?></td>
                <td><?= $row['item'] ?></td>
                <td><?= $row['fault'] ?></td>
                <td><?= $row['uniq_id'] ?></td>
                <td><?= number_format($row['amount'], 2) ?></td>
                <td><?= $status_text ?></td>
            </tr>
            <?php endwhile; ?>
        </tbody>
    </table>
</body>
</html>