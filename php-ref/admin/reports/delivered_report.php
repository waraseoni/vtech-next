<?php
// तारीखों और क्लाइंट को सेट करें
$from_date = isset($_GET['from_date']) ? $_GET['from_date'] : date("Y-m-d");
$to_date = isset($_GET['to_date']) ? $_GET['to_date'] : date("Y-m-d");
$client_id = isset($_GET['client_id']) ? $_GET['client_id'] : 'all';

// Previous और Next Day कैलकुलेशन
$prev_day = date('Y-m-d', strtotime($from_date . ' -1 day'));
$next_day = date('Y-m-d', strtotime($from_date . ' +1 day'));

// Selected Client का naam nikalne ke liye
$selected_client_name = "All Clients";
if($client_id != 'all'){
    $client_qry = $conn->query("SELECT CONCAT(firstname,' ',lastname) as name FROM client_list WHERE id = '{$client_id}'");
    if($client_qry->num_rows > 0){
        $selected_client_name = $client_qry->fetch_assoc()['name'];
    }
}
?>

<style>
    /* Balance badges */
    .badge-due {
        background: #fc8181;
        color: white;
        font-size: 0.75rem;
        padding: 3px 8px;
        border-radius: 10px;
        font-weight: 600;
        display: inline-block;
    }
    .badge-adv {
        background: #68d391;
        color: white;
        font-size: 0.75rem;
        padding: 3px 8px;
        border-radius: 10px;
        font-weight: 600;
    }
    .badge-zero {
        background: #a0aec0;
        color: white;
        font-size: 0.75rem;
        padding: 3px 8px;
        border-radius: 10px;
        font-weight: 600;
    }
    /* Client cell */
    .client-cell {
        display: flex;
        flex-direction: column;
        line-height: 1.3;
    }
    .client-name {
        font-weight: 700;
        color: #2d3748;
        font-size: 0.95rem;
        margin-bottom: 2px;
    }
    .client-name a {
        color: inherit;
        text-decoration: none;
    }
    .client-name a:hover {
        text-decoration: underline;
    }
    /* Quick action buttons */
    .action-btn-group {
        display: flex;
        gap: 4px;
        justify-content: center;
    }
    .action-btn-group .btn {
        padding: 4px 8px;
        font-size: 0.8rem;
    }
    /* Summary cards */
    .small-box {
        border-radius: 0.5rem;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        margin-bottom: 1rem;
    }
    .small-box > .inner {
        padding: 15px;
    }
    .small-box h3 {
        font-size: 2rem;
        font-weight: 700;
        margin: 0 0 5px 0;
        white-space: nowrap;
    }
    .small-box p {
        font-size: 1rem;
        margin-bottom: 0;
    }
    .small-box .icon {
        position: absolute;
        top: 10px;
        right: 15px;
        font-size: 3rem;
        opacity: 0.3;
    }
</style>

<div class="card card-outline card-primary">
    <div class="card-header">
        <h3 class="card-title">Delivered Items Report</h3>
        <div class="card-tools">
            <button class="btn btn-flat btn-sm btn-success" onclick="window.print()"><i class="fa fa-print"></i> Print</button>
        </div>
    </div>
    <div class="card-body">
        <form id="filter-form" class="mb-4 no-print" method="GET">
            <input type="hidden" name="page" value="reports/delivered_report">
            <div class="row align-items-end">
                <div class="col-md-3">
                    <label for="from_date" class="control-label">From Date</label>
                    <input type="date" id="from_date" name="from_date" value="<?= $from_date ?>" class="form-control form-control-sm">
                </div>
                <div class="col-md-3">
                    <label for="to_date" class="control-label">To Date</label>
                    <input type="date" id="to_date" name="to_date" value="<?= $to_date ?>" class="form-control form-control-sm">
                </div>
                <div class="col-md-3">
                    <label for="client_id" class="control-label">Client Name</label>
                    <select name="client_id" id="client_id" class="form-control form-control-sm select2">
                        <option value="all" <?= $client_id == 'all' ? 'selected' : '' ?>>All Clients</option>
                        <?php 
                        $clients = $conn->query("SELECT id, CONCAT(firstname,' ',middlename,' ',lastname) as name FROM client_list ORDER BY firstname ASC");
                        while($c_row = $clients->fetch_assoc()):
                        ?>
                        <option value="<?= $c_row['id'] ?>" <?= $client_id == $c_row['id'] ? 'selected' : '' ?>><?= $c_row['name'] ?></option>
                        <?php endwhile; ?>
                    </select>
                </div>
                <div class="col-md-3">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-primary btn-flat" type="submit"><i class="fa fa-filter"></i> Filter</button>

                        <a href="./?page=reports/delivered_report&from_date=<?= $prev_day ?>&to_date=<?= $prev_day ?>&client_id=<?= $client_id ?>" class="btn btn-outline-secondary btn-flat" title="Previous Day">
                            <i class="fa fa-angle-left"></i>
                        </a>
						
						<a href="./?page=reports/delivered_report" class="btn btn-default btn-flat border" title="Reset Filter">
                            <i class="fa fa-redo"></i> Reset
                        </a>
						
                        <a href="./?page=reports/delivered_report&from_date=<?= $next_day ?>&to_date=<?= $next_day ?>&client_id=<?= $client_id ?>" class="btn btn-outline-secondary btn-flat" title="Next Day">
                            <i class="fa fa-angle-right"></i>
                        </a>
                    </div>
                </div>
            </div>
        </form>

        <?php 
        // --- Data query for stats and table ---
        $client_filter = ($client_id != 'all') ? " AND t.client_name = '{$client_id}' " : "";

        $qry = $conn->query("SELECT t.*, 
                CONCAT(c.firstname,' ',COALESCE(c.middlename,''),' ',c.lastname) as client_full_name,
                c.id as client_tbl_id,
                c.contact,
                c.opening_balance,
                (SELECT SUM(amount) FROM transaction_list tl WHERE tl.client_name = c.id AND tl.status = 5) as total_billed,
                (SELECT SUM(amount + discount) FROM client_payments cp WHERE cp.client_id = c.id) as total_paid,
                (SELECT SUM(total_amount) FROM direct_sales ds WHERE ds.client_id = c.id) as total_sale
                FROM `transaction_list` t 
                INNER JOIN client_list c ON t.client_name = c.id 
                WHERE t.status = 5 
                AND date(t.date_completed) BETWEEN '{$from_date}' AND '{$to_date}' 
                {$client_filter}
                ORDER BY t.date_completed DESC");

        // Calculate summary stats
        $total_amount = 0;
        $total_count = $qry->num_rows;
        $client_ids = [];
        while($row = $qry->fetch_assoc()) {
            $total_amount += $row['amount'];
            $client_ids[] = $row['client_tbl_id'];
        }
        $unique_clients = count(array_unique($client_ids));
        $avg_bill = $total_count > 0 ? $total_amount / $total_count : 0;

        // Reset pointer for main loop
        $qry->data_seek(0);
        ?>

        <!-- Summary Cards -->
        <div class="row mb-4 no-print">
            <div class="col-lg-3 col-6">
                <div class="small-box bg-success">
                    <div class="inner">
                        <h3><?= $total_count ?></h3>
                        <p>Total Delivered</p>
                    </div>
                    <div class="icon"><i class="fas fa-check-circle"></i></div>
                </div>
            </div>
            <div class="col-lg-3 col-6">
                <div class="small-box bg-warning">
                    <div class="inner">
                        <h3>₹<?= number_format($total_amount,2) ?></h3>
                        <p>Total Amount</p>
                    </div>
                    <div class="icon"><i class="fas fa-rupee-sign"></i></div>
                </div>
            </div>
            <div class="col-lg-3 col-6">
                <div class="small-box bg-info">
                    <div class="inner">
                        <h3><?= $unique_clients ?></h3>
                        <p>Unique Clients</p>
                    </div>
                    <div class="icon"><i class="fas fa-users"></i></div>
                </div>
            </div>
            <div class="col-lg-3 col-6">
                <div class="small-box bg-danger">
                    <div class="inner">
                        <h3>₹<?= number_format($avg_bill,2) ?></h3>
                        <p>Average Bill</p>
                    </div>
                    <div class="icon"><i class="fas fa-chart-line"></i></div>
                </div>
            </div>
        </div>

        <!-- Report Header (for print) -->
        <div id="print-area">
            <div class="report-header text-center mb-4">
                <h3 class="mb-1"><b>Delivered Items Report</b></h3>
                
                <div class="client-info mt-3">
                    <?php if($client_id != 'all'): ?>
                        <span style="font-size: 1.4rem;">Client: <b class="text-dark"><?= ucwords($selected_client_name) ?></b></span>
                    <?php else: ?>
                        <span style="font-size: 1.4rem;">Showing: <b class="text-dark">All Clients</b></span>
                    <?php endif; ?>
                </div>

                <div class="date-info text-muted">
                    <span style="font-size: 1.1rem;">
                        Period: <?= date("d M Y", strtotime($from_date)) ?> 
                        <?php if($from_date != $to_date): ?>
                            - <?= date("d M Y", strtotime($to_date)) ?>
                        <?php endif; ?>
                    </span>
                </div>
            </div>
            <hr>

            <table class="table table-bordered table-striped table-hover">
                <thead class="bg-navy text-white text-sm">
                    <tr>
                        <th class="text-center">#</th>
                        <th>Job ID</th>
                        <th>Delivery Date</th>
                        <th>Client Name & Balance</th>
                        <th>Item Details</th>
                        <th>Amount</th>
                        <th class="no-print text-center">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $i = 1;
                    if($qry->num_rows > 0):
                        while($row = $qry->fetch_assoc()):
                            // Balance calculation
                            $calc_sale = $row['total_sale'] ?? 0;
                            $calc_billed = $row['total_billed'] ?? 0;
                            $calc_paid = $row['total_paid'] ?? 0;
                            $calc_opening = $row['opening_balance'] ?? 0;
                            $current_balance = ($calc_opening + $calc_billed + $calc_sale) - $calc_paid;

                            if($current_balance > 0){
                                $bal_badge = '<span class="badge-due">Due: ₹' . number_format($current_balance, 2) . '</span>';
                            } elseif($current_balance < 0) {
                                $bal_badge = '<span class="badge-adv">Adv: ₹' . number_format(abs($current_balance), 2) . '</span>';
                            } else {
                                $bal_badge = '<span class="badge-zero">Bal: ₹0.00</span>';
                            }
                    ?>
                    <tr>
                        <td class="text-center"><?= $i++; ?></td>
                        <td class="font-weight-bold">
                            <a href="./?page=transactions/view_details&id=<?= $row['id'] ?>" class="text-primary">
                                <?= $row['job_id'] ?>
                            </a>
                        </td>
                        <td><?= date("d-m-Y h:i A", strtotime($row['date_completed'])) ?></td>
                        <td>
                            <div class="client-cell">
                                <div class="client-name">
                                    <a href="./?page=clients/view_client&id=<?= $row['client_tbl_id'] ?>" target="_blank">
                                        <?= ucwords($row['client_full_name']) ?>
                                    </a>
                                </div>
                                <div class="mt-1">
                                    <?= $bal_badge ?>
                                </div>
                            </div>
                        </td>
                        <td><?= $row['item'] ?></td>
                        <td class="text-right">₹<?= number_format($row['amount'], 2) ?></td>
                        <td class="text-center no-print">
                            <div class="action-btn-group">
                                <a href="./?page=transactions/view_details&id=<?= $row['id'] ?>" class="btn btn-info btn-sm" title="View Details">
                                    <i class="fa fa-eye"></i>
                                </a>
                                <a href="../pdf/bill_template.php?job_id=<?= $row['job_id'] ?>" target="_blank" class="btn btn-success btn-sm" title="Print Bill">
                                    <i class="fa fa-print"></i>
                                </a>
                                <a href="javascript:void(0)" onclick="sendWA('<?= $row['job_id'] ?>', '<?= $row['contact'] ?>', '<?= $row['amount'] ?>', '<?= addslashes($row['client_full_name']) ?>', '<?= $row['code'] ?>', '<?= addslashes($row['item']) ?>', '5')" class="btn btn-success btn-sm" title="WhatsApp">
                                    <i class="fab fa-whatsapp"></i>
                                </a>
                            </div>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                    <tr class="bg-light font-weight-bold">
                        <th colspan="5" class="text-right">Total Amount:</th>
                        <th class="text-right">₹<?= number_format($total_amount, 2) ?></th>
                        <td class="no-print"></td>
                    </tr>
                    <?php else: ?>
                    <tr><td class="text-center" colspan="7">No delivered items found in this period.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
    $(document).ready(function(){
        $('.select2').select2({
            placeholder: "Select Client",
            width: '100%'
        });
    });

    // WhatsApp function (copied from index.php)
    function sendWA(job_id, phone, amount, client_name, code, item, status) {
        phone = phone.replace(/\D/g, '');
        if (phone.length < 10) { alert("Valid mobile number nahi mila!"); return; }
        
        let msg = "";
        let formattedAmount = parseFloat(amount).toLocaleString('en-IN');
        let businessName = "Vikram Jain, V-Technologies, Jabalpur, Mob. 9179105875";

        switch (parseInt(status)) {
            case 5:
                msg = `Namaste ${client_name} ji 🙏!\n\n` +
                      `Aapka *${item}* (Job ID: #${job_id}) (Code: #${code}) deliver kar diya gaya hai. 🏁\n\n` +
                      `Total Paid: *₹${formattedAmount}*\n\n` +
                      `V-Technologies ki seva lene ke liye dhanyavaad. ⭐\n\n` +
                      `${businessName}`;
                break;
            default:
                msg = `Namaste ${client_name} ji 🙏!\n\nAapka Job ID: #${job_id} (${item}) ka status update kar diya gaya hai. Dhanyavaad! ❤️`;
        }

        window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
</script>