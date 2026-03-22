<?php
// तारीखों को सेट करें
$from_date = isset($_GET['from_date']) ? $_GET['from_date'] : date("Y-m-d");
$to_date = isset($_GET['to_date']) ? $_GET['to_date'] : date("Y-m-d");

// Previous और Next Day कैलकुलेशन (From Date के आधार पर)
$prev_day = date('Y-m-d', strtotime($from_date . ' -1 day'));
$next_day = date('Y-m-d', strtotime($from_date . ' +1 day'));
?>

<div class="card card-outline card-primary">
    <div class="card-header">
        <h3 class="card-title">Delivered Items Report</h3>
        <div class="card-tools">
            <button class="btn btn-flat btn-sm btn-success" onclick="window.print()"><i class="fa fa-print"></i> Print</button>
        </div>
    </div>
    <div class="card-body">
        <form id="filter-form" class="mb-4 no-print">
            <div class="row align-items-end">
                <div class="col-md-3">
                    <label for="from_date">From Date</label>
                    <input type="date" id="from_date" name="from_date" value="<?= $from_date ?>" class="form-control" required>
                </div>
                <div class="col-md-3">
                    <label for="to_date">To Date</label>
                    <input type="date" id="to_date" name="to_date" value="<?= $to_date ?>" class="form-control" required>
                </div>
                <div class="col-md-6 mt-2">
                    <button class="btn btn-primary btn-flat" type="submit"><i class="fa fa-filter"></i> Filter</button>
                    
                    <a href="./?page=reports/delivered_report&from_date=<?= $prev_day ?>&to_date=<?= $prev_day ?>" class="btn btn-outline-secondary btn-flat">
                        <i class="fa fa-angle-left"></i> Previous Day
                    </a>
                    
                    <a href="./?page=reports/delivered_report&from_date=<?= $next_day ?>&to_date=<?= $next_day ?>" class="btn btn-outline-secondary btn-flat">
                        Next Day <i class="fa fa-angle-right"></i>
                    </a>
                </div>
            </div>
        </form>

        <div id="print-area">
            <h4 class="text-center mb-3">Delivered Items Report</h4>
            <p class="text-center text-muted">
                <?php if($from_date == $to_date): ?>
                    Date: <b><?= date("d M Y", strtotime($from_date)) ?></b>
                <?php else: ?>
                    From <b><?= date("d M Y", strtotime($from_date)) ?></b> To <b><?= date("d M Y", strtotime($to_date)) ?></b>
                <?php endif; ?>
            </p>
            
            <table class="table table-bordered table-striped table-hover">
                <thead class="bg-navy text-white text-sm">
                    <tr>
                        <th class="text-center">#</th>
                        <th>Job ID</th>
                        <th>Delivery Date</th>
                        <th>Client Name</th>
                        <th>Item Details</th>
                        <th>Amount</th>
                        <th class="no-print">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $i = 1;
                    $total_amount = 0;
                    $qry = $conn->query("SELECT t.*, 
                            CONCAT(c.firstname,' ',COALESCE(c.middlename,''),' ',c.lastname) as client_full_name,
                            c.id as client_tbl_id
                            FROM `transaction_list` t 
                            INNER JOIN client_list c ON t.client_name = c.id 
                            WHERE t.status = 5 
                            AND date(t.date_completed) BETWEEN '{$from_date}' AND '{$to_date}' 
                            ORDER BY t.date_completed DESC");

                    if($qry->num_rows > 0):
                        while($row = $qry->fetch_assoc()):
                            $total_amount += $row['amount'];
                    ?>
                    <tr>
                        <td class="text-center"><?php echo $i++; ?></td>
                        <td class="text-center font-weight-bold">
							<a href="./?page=transactions/view_details&id=<?php echo $row['id'] ?>" class="text-primary">
								<?= $row['job_id'] ?>
							</a>
						</td>
                        <td><?= date("d-m-Y h:i A", strtotime($row['date_completed'])) ?></td>
                        <td>
                            <a href="./?page=clients/view_client&id=<?= $row['client_tbl_id'] ?>" class="text-dark">
                                <i class="fa fa-user text-xs text-muted mr-1"></i> <?= ucwords($row['client_full_name']) ?>
                            </a>
                        </td>
                        <td><?= $row['item'] ?></td>
                        <td class="text-right">₹<?= number_format($row['amount'], 2) ?></td>
                        <td align="center" class="no-print">
                            <button type="button" class="btn btn-flat btn-default btn-sm view_details" data-id="<?php echo $row['id'] ?>">
                                <i class="fa fa-eye text-primary"></i>
                            </button>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                        <tr class="bg-light font-weight-bold">
                            <th colspan="5" class="text-right">Total Amount:</th>
                            <th class="text-right">₹<?= number_format($total_amount, 2) ?></th>
                            <td></td>
                        </tr>
                    <?php else: ?>
                    <tr>
                        <td class="text-center" colspan="7">No items delivered in this period.</td>
                    </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
    $(document).ready(function(){
        // Modal के बजाय सीधा पेज पर ले जाने के लिए
        $('.view_details').click(function(){
            var id = $(this).attr('data-id');
            // 'uni_modal' को हटाकर 'location.href' का उपयोग करें
            location.href = "./?page=transactions/view_details&id=" + id;
        });
    });
</script>