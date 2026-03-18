<?php
// 1. URL parameters handle karna
$from = isset($_GET['from']) ? $_GET['from'] : date("Y-m-01");
$to = isset($_GET['to']) ? $_GET['to'] : date("Y-m-t");
$client_id = isset($_GET['client_id']) ? $_GET['client_id'] : 'all';

// 2. Query Build karna (Filter ke hisab se)
$where = " WHERE cp.payment_date BETWEEN '{$from}' AND '{$to}' ";
if($client_id != 'all'){
    $where .= " AND cp.client_id = '{$client_id}' ";
}

// 3. SQL Query: Client Payments aur Client List ko jodkar
$qry = $conn->query("
    SELECT 
        cp.*,
        concat(cl.firstname, ' ', cl.lastname) as client_name,
        cl.contact
    FROM client_payments cp
    INNER JOIN client_list cl ON cp.client_id = cl.id
    {$where}
    ORDER BY cp.payment_date DESC
");

// 4. Sabhi Clients ki list nikalna Dropdown ke liye
$clients_list = $conn->query("SELECT id, concat(firstname, ' ', lastname) as name FROM client_list ORDER BY firstname ASC");
?>

<div class="card card-outline card-primary">
    <div class="card-header">
        <h3 class="card-title">Client Payment Report</h3>
        <div class="card-tools">
            <button class="btn btn-success btn-sm btn-flat" onclick="window.print()"><i class="fa fa-print"></i> Print</button>
        </div>
    </div>
    <div class="card-body">
        <form action="" method="GET" class="no-print mb-4">
            <input type="hidden" name="page" value="reports/client_payment_report">
            <div class="row align-items-end">
                <div class="col-md-3">
                    <label>Client</label>
                    <select name="client_id" class="form-control select2">
                        <option value="all" <?= $client_id == 'all' ? 'selected' : '' ?>>All Clients</option>
                        <?php while($row = $clients_list->fetch_assoc()): ?>
                            <option value="<?= $row['id'] ?>" <?= $client_id == $row['id'] ? 'selected' : '' ?>><?= $row['name'] ?></option>
                        <?php endwhile; ?>
                    </select>
                </div>
                <div class="col-md-3">
                    <label>From</label>
                    <input type="date" name="from" value="<?= $from ?>" class="form-control">
                </div>
                <div class="col-md-3">
                    <label>To</label>
                    <input type="date" name="to" value="<?= $to ?>" class="form-control">
                </div>
                <div class="col-md-3">
                    <button class="btn btn-primary btn-flat"><i class="fa fa-filter"></i> Filter</button>
                    <a href="./?page=reports/client_payment_report" class="btn btn-default border btn-flat">Reset</a>
                </div>
            </div>
        </form>

        <table class="table table-bordered table-striped">
            <thead class="bg-navy">
                <tr>
                    <th>Date</th>
                    <th>Client Name</th>
                    <th>Mode</th>
                    <th>Remarks</th>
                    <th class="text-right">Amount</th>
                </tr>
            </thead>
            <tbody>
                <?php 
                $total = 0;
                while($row = $qry->fetch_assoc()): 
                    $total += $row['amount'];
                ?>
                <tr>
                    <td><?= date("d-M-Y", strtotime($row['payment_date'])) ?></td>
                    <td><b><?= $row['client_name'] ?></b></td>
                    <td><?= $row['payment_mode'] ?></td>
                    <td><small><?= $row['remarks'] ?></small></td>
                    <td class="text-right">₹ <?= number_format($row['amount'], 2) ?></td>
                </tr>
                <?php endwhile; ?>
            </tbody>
            <tfoot class="bg-light font-weight-bold">
                <tr>
                    <td colspan="4" class="text-right">Total:</td>
                    <td class="text-right">₹ <?= number_format($total, 2) ?></td>
                </tr>
            </tfoot>
        </table>
    </div>
</div>