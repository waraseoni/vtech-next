<?php
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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transaction Report - Print</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h2 { color: #001f3f; text-align: center; border-bottom: 2px solid #001f3f; padding-bottom: 10px; }
        .report-info { text-align: center; margin-bottom: 20px; color: #666; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #001f3f; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .status-pending { color: #6c757d; }
        .status-progress { color: #007bff; }
        .status-done { color: #17a2b8; }
        .status-paid { color: #28a745; }
        .status-cancelled { color: #dc3545; }
        .status-delivered { color: #ffc107; }
        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; }
    </style>
</head>
<body>
    <h2>Transaction History Report</h2>
    <div class="report-info">
        <p><strong>Date:</strong> <?= date("d M Y") ?></p>
        <?php if(!empty($date_from) && !empty($date_to)): ?>
        <p><strong>Period:</strong> <?= $date_from ?> to <?= $date_to ?></p>
        <?php endif; ?>
        <p><strong>V-Technologies, Jabalpur</strong></p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th class="text-center">#</th>
                <th>Date & Time</th>
                <th>Job No.</th>
                <th>Code</th>
                <th>Client Name</th>
                <th>Contact</th>
                <th>Item/Model</th>
                <th>Fault</th>
                <th>Locate</th>
                <th class="text-right">Amount (₹)</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            <?php 
            $i = 1;
            $total_amount = 0;
            while($row = $qry->fetch_assoc()):
                $fullname = trim($row['firstname'] . ' ' . $row['middlename'] . ' ' . $row['lastname']);
                $status_text = '';
                $status_class = '';
                switch($row['status']){
                    case 0: $status_text = 'Pending'; $status_class = 'status-pending'; break;
                    case 1: $status_text = 'On-Progress'; $status_class = 'status-progress'; break;
                    case 2: $status_text = 'Done'; $status_class = 'status-done'; break;
                    case 3: $status_text = 'Paid'; $status_class = 'status-paid'; break;
                    case 4: $status_text = 'Cancelled'; $status_class = 'status-cancelled'; break;
                    case 5: $status_text = 'Delivered'; $status_class = 'status-delivered'; break;
                }
                $total_amount += $row['amount'];
            ?>
            <tr>
                <td class="text-center"><?= $i++ ?></td>
                <td><?= date("d M Y, h:i A", strtotime($row['date_created'])) ?></td>
                <td><?= $row['job_id'] ?></td>
                <td><?= !empty($row['code']) ? $row['code'] : 'No Code' ?></td>
                <td><?= $fullname ?></td>
                <td><?= $row['contact'] ?></td>
                <td><?= $row['item'] ?></td>
                <td><?= $row['fault'] ?></td>
                <td><?= $row['uniq_id'] ?></td>
                <td class="text-right"><?= number_format($row['amount'], 2) ?></td>
                <td class="<?= $status_class ?>"><?= $status_text ?></td>
            </tr>
            <?php endwhile; ?>
        </tbody>
        <tfoot>
            <tr>
                <th colspan="9" class="text-right">Total:</th>
                <th class="text-right">₹ <?= number_format($total_amount, 2) ?></th>
                <th></th>
            </tr>
        </tfoot>
    </table>
    
    <div class="footer">
        <p>Generated on: <?= date("d M Y h:i A") ?></p>
        <p>V-Technologies, Jabalpur | Mob: 9179105875</p>
    </div>
    
    <script>
        window.onload = function() {
            window.print();
            setTimeout(function() {
                window.close();
            }, 500);
        }
    </script>
</body>
</html>