<?php include '../config.php'; ?>
<?php include '../inc/header.php'; ?>
<h2>Pending Jobs (Delivery Baaki)</h2>
<table class="table table-bordered table-hover">
    <thead class="table-danger">
        <tr>
            <th>Job ID</th>
            <th>Client</th>
            <th>Item</th>
            <th>Fault</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Action</th>
        </tr>
    </thead>
    <tbody>
    <?php 
    $qry = $conn->query("SELECT t.*, c.firstname, c.lastname FROM transaction_list t LEFT JOIN client_list c ON t.client_name=c.id WHERE t.status != 5 ORDER BY t.date_created DESC");
    while($row = $qry->fetch_assoc()): 
    $client_name = $row['firstname'].' '.$row['lastname'];
    ?>
        <tr class="pending-job">
            <td><b><?php echo $row['job_id'] ?></b></td>
            <td><?php echo $client_name ?></td>
            <td><?php echo $row['item'] ?></td>
            <td><?php echo $row['fault'] ?></td>
            <td>₹<?php echo $row['amount'] ?></td>
            <td><?php echo date("d/m/Y", strtotime($row['date_created'])) ?></td>
            <td>
                <button class="btn btn-success btn-sm" onclick="sendWhatsApp('<?php echo $row['job_id'] ?>','<?php echo $row['client_name'] ?>','<?php echo $row['contact'] ?>')">
                    WhatsApp
                </button>
            </td>
        </tr>
    <?php endwhile; ?>
    </tbody>
</table>
<?php include '../includes/footer.php'; ?>