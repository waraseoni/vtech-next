<?php 
require_once('../config.php'); 

// 1. Validation: Check Client ID
if(!isset($_GET['id']) || !is_numeric($_GET['id'])){
    echo '<script> alert("Valid Client ID is required."); location.replace("./?page=clients_admin"); </script>';
    exit;
}

$id = $_GET['id'];

// 2. Fetch Client Details (Prepared Statement)
$stmt_client = $conn->prepare("SELECT * FROM `client_list` WHERE id = ?");
$stmt_client->bind_param("i", $id);
$stmt_client->execute();
$res_client = $stmt_client->get_result();

if($res_client->num_rows > 0){
    $client = $res_client->fetch_assoc();
    foreach($client as $k => $v){
        if(!is_numeric($k)) $$k = $v;
    }
    $client_name_full = trim($firstname.' '.($middlename ? $middlename.' ' : '').$lastname);
} else {
    echo '<script> alert("Client not found."); location.replace("./?page=clients_admin"); </script>';
    exit;
}
$stmt_client->close();

// 3. Fetch Accounting Summary (Optimized with Prepared Statements)
// Total Billed (Status 5 = Delivered)
//$stmt_billed = $conn->prepare("SELECT SUM(amount) as total_billed FROM transaction_list WHERE client_name = ? AND status = 5");
//$stmt_billed->bind_param("i", $id);
//$stmt_billed->execute();
//$total_billed = $stmt_billed->get_result()->fetch_assoc()['total_billed'] ?? 0;


// Total Paid
//$stmt_paid = $conn->prepare("SELECT SUM(amount + discount) as total_paid FROM client_payments WHERE client_id = ?");
//$stmt_paid->bind_param("i", $id);
//$stmt_paid->execute();
//$total_paid = $stmt_paid->get_result()->fetch_assoc()['total_paid'] ?? 0;

//$balance = (float)$opening_balance + (float)$total_billed - (float)$total_paid;
// Standard Calculation Logic (Same as Master.php)
// Total Billed
$stmt_billed = $conn->prepare("SELECT SUM(amount) as total FROM transaction_list WHERE client_name = ? AND status = 5");
$stmt_billed->bind_param("i", $id);
$stmt_billed->execute();
$total_billed = $stmt_billed->get_result()->fetch_assoc()['total'] ?? 0;

// Total Paid
$stmt_paid = $conn->prepare("SELECT SUM(amount + discount) as total FROM client_payments WHERE client_id = ?");
$stmt_paid->bind_param("i", $id);
$stmt_paid->execute();
$total_paid = $stmt_paid->get_result()->fetch_assoc()['total'] ?? 0;

// Final Balance
$final_balance = ($opening_balance + $total_billed) - $total_paid;
?>

<div class="content py-3">
    <div class="card card-outline card-primary shadow-sm">
        <div class="card-header">
            <h3 class="card-title"><b>Client Profile: <?= $client_name_full ?></b></h3>
            <div class="card-tools">
                <a href="./?page=clients_admin" class="btn btn-default btn-sm border"><i class="fa fa-angle-left"></i> Back to List</a>
				<a href="clients/repair_history_pdf.php?id=<?= $id ?>" target="_blank" class="btn btn-info btn-sm"><i class="fa fa-file-pdf"></i> Repair Jobs PDF</a>
                <a href="clients/payment_ledger_pdf.php?id=<?= $id ?>" target="_blank" class="btn btn-danger btn-sm"><i class="fa fa-file-pdf"></i> Ledger PDF</a>
                <button type="button" class="btn btn-primary btn-sm edit_client" data-id="<?= $id ?>"><i class="fa fa-edit"></i> Edit Details</button>
				<button type="button" class="btn btn-success btn-sm" data-toggle="modal" data-target="#paymentModal"><i class="fa fa-plus"></i> Add Payment</button>
            </div>
        </div>
        <div class="card-body">
            <div class="container-fluid">
                <div class="row mb-4">
                    <div class="col-md-3">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Opening Balance</span>
                                <span class="info-box-number text-primary">₹<?= number_format($opening_balance, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Total Billed</span>
                                <span class="info-box-number text-dark">₹<?= number_format($total_billed, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Total Received</span>
                                <span class="info-box-number text-success">₹<?= number_format($total_paid, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="info-box bg-light border">
							<div class="info-box-content">
								<span class="info-box-text"><?= $final_balance >= 0 ? 'Due Balance' : 'Advance Amount' ?></span>
								<span class="info-box-number" style="color: <?= $final_balance >= 0 ? '#dc3545' : '#28a745' ?>;">
							₹ <?= number_format(abs($final_balance), 2) ?>
							</span>
							</div>
						</div>
                    </div>
                </div>

                <div class="row border-bottom pb-3 mb-3">
                    <div class="col-md-6">
                        <p><b><i class="fa fa-phone-alt"></i> Mobile:</b> <?= $contact ?></p>
                       <?php 
// Check karein ki kaunsa variable available hai
$display_wa = isset($whatsapp_no) ? $whatsapp_no : (isset($contact) ? $contact : '');
?>

<p>
    <b><i class="fab fa-whatsapp text-success"></i> WhatsApp:</b> 
    <?php if($display_wa): ?>
        <a href="https://wa.me/91<?= $display_wa ?>" target="_blank"><?= $display_wa ?></a>
    <?php else: ?>
        <span>N/A</span>
    <?php endif; ?>
</p>
                    </div>
                    <div class="col-md-6">
                        <p><b><i class="fa fa-envelope"></i> Email:</b> <?= $email ?: 'N/A' ?></p>
                        <p><b><i class="fa fa-map-marker-alt text-danger"></i> Address:</b> <?= $address ?></p>
                    </div>
                </div>

                <div class="card card-tabs">
                    <div class="card-header p-0 pt-1">
                        <ul class="nav nav-tabs" id="clientTabs" role="tablist">
    <li class="nav-item">
        <a class="nav-link active" data-toggle="pill" href="#repairs" role="tab">
            <i class="fa fa-tools"></i> Repair History
        </a>
    </li>
    <li class="nav-item">
        <a class="nav-link" data-toggle="pill" href="#payments" role="tab">
            <i class="fa fa-receipt"></i> Payment Ledger
        </a>
    </li>
</ul>
                    </div>
                    <div class="card-body">
					<div class="row align-items-end mb-3">
    <div class="col-md-3">
        <label for="date_from" class="control-label">From Date</label>
        <input type="date" id="date_from" class="form-control form-control-sm">
    </div>
    <div class="col-md-3">
        <label for="date_to" class="control-label">To Date</label>
        <input type="date" id="date_to" class="form-control form-control-sm">
    </div>
    <div class="col-md-4">
        <button class="btn btn-primary btn-sm" type="button" id="filter_dates"><i class="fa fa-filter"></i> Filter</button>
        <button class="btn btn-default btn-sm border" type="button" id="reset_filter">Reset</button>
    </div>
</div>
                        <div class="tab-content">
                            <div class="tab-pane fade show active" id="repairs">
                                <table class="table table-hover table-striped table-bordered datatable">
                                    <thead class="bg-navy">
                                        <tr>
                                            <th>Date</th>
                                            <th>Job ID</th>
											<th>Code</th>
                                            <th>Item/Model</th>
                                            <th>Status</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php 
                                        $stmt_repairs = $conn->prepare("SELECT * FROM transaction_list WHERE client_name = ? ORDER BY date_created DESC");
                                        $stmt_repairs->bind_param("i", $id);
                                        $stmt_repairs->execute();
                                        $repairs = $stmt_repairs->get_result();
                                        while($row = $repairs->fetch_assoc()):
                                        ?>
                                        <tr>
                                            <td><?= date("d-m-Y", strtotime($row['date_created'])) ?></td>
                                           <td><a href="./?page=transactions/view_details&id=<?= $row['id'] ?>"><?= $row['job_id'] ?></a></td>
										   <td><a href="./?page=transactions/view_details&id=<?= $row['id'] ?>"><?= $row['code'] ?></a></td>
                                            <td><?= $row['item'] ?></td>
                                            <td class="text-center">
    <?php 
    $status_text = '';
    $status_color = '';
    switch($row['status']){
        case 0: $status_text = 'Pending'; $status_color = 'secondary'; break;
        case 1: $status_text = 'In Progress'; $status_color = 'info'; break;
        case 2: $status_text = 'Done'; $status_color = 'warning'; break;
        case 3: $status_text = 'Paid'; $status_color = 'success'; break;
        case 5: $status_text = 'Delivered'; $status_color = 'primary'; break;
        case 4: $status_text = 'Cancelled'; $status_color = 'danger'; break;
        default: $status_text = 'Unknown'; $status_color = 'dark'; break;
    }
    ?>
    <span class="badge badge-<?= $status_color ?> px-3 py-2">
        <?= $status_text ?>
    </span>
</td>
                                            <td class="text-right">₹<?= number_format($row['amount'], 2) ?></td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                </table>
                            </div>

                            <div class="tab-pane fade" id="payments">
                                <table class="table table-hover table-striped table-bordered datatable">
                                    <thead class="bg-navy">
                                        <tr>
                                            <th>Date</th>
                                            <th>Ref. ID</th>
                                            <th>Amount</th>
                                            <th>Disc.</th>
                                            <th>Net</th>
                                            <th>Mode</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php 
                                        $stmt_plist = $conn->prepare("SELECT * FROM client_payments WHERE client_id = ? ORDER BY payment_date DESC");
                                        $stmt_plist->bind_param("i", $id);
                                        $stmt_plist->execute();
                                        $plist = $stmt_plist->get_result();
                                        while($row = $plist->fetch_assoc()):
                                        ?>
                                        <tr>
                                            <td><?= date("d-m-Y", strtotime($row['payment_date'])) ?></td>
                                            <td><?= $row['job_id'] ?: ($row['bill_no'] ?: 'Direct') ?></td>
                                            <td>₹<?= number_format($row['amount'], 2) ?></td>
                                            <td>₹<?= number_format($row['discount'], 2) ?></td>
                                            <td class="font-weight-bold text-success">₹<?= number_format($row['amount'] + $row['discount'], 2) ?></td>
                                            <td><?= $row['payment_mode'] ?></td>
                                            <td class="text-center">
                                                <button type="button" class="btn btn-sm btn-info edit_payment" data-id="<?= $row['id'] ?>"><i class="fa fa-edit"></i></button>
                                                <button type="button" class="btn btn-sm btn-danger delete_payment" data-id="<?= $row['id'] ?>"><i class="fa fa-trash"></i></button>
                                            </td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="paymentModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Record New Payment</h5>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>
            <form action="clients/save_payment.php" method="POST">
                <div class="modal-body">
                    <input type="hidden" name="client_id" value="<?= $id ?>">
                    <div class="row">
                        <div class="col-md-4 form-group">
                            <label>Amount Received</label>
                            <input type="number" step="any" name="amount" class="form-control" required>
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Discount (if any)</label>
                            <input type="number" step="any" name="discount" class="form-control" value="0">
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Payment Mode</label>
                            <select name="payment_mode" class="form-control" required>
                                <option>Cash</option>
                                <option>PhonePe/GPay</option>
                                <option>Bank Transfer</option>
                            </select>
                        </div>
                        <div class="col-md-12 form-group">
                            <label>Remarks</label>
                            <textarea name="remarks" class="form-control" rows="2"></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">Save Payment</button>
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                </div>
            </form>
        </div>
    </div>
</div>

<style>
    /* Active Tab ka background aur text color */
    .nav-tabs .nav-link.active {
        background-color: #007bff !important; /* Blue Color */
        color: #ffffff !important;            /* White Text */
        border-color: #007bff #007bff #fff !important;
        font-weight: bold;
    }
    
    /* Hover karne par halka color change */
    .nav-tabs .nav-link:hover {
        background-color: #f8f9fa;
        border-color: #dee2e6;
    }

    /* Tab content area ko thoda padding aur border dena */
    .tab-content {
        border: 1px solid #dee2e6;
        border-top: none;
        padding: 20px;
        background: #fff;
    }
</style>
<script>
$(function(){
    // 1. Initialize DataTables with specific IDs for filtering control
    // We target the tables within their specific tab IDs
    var repairTable = $('#repairs table').DataTable({
        "order": [[0, "desc"]]
    });
    
    var paymentTable = $('#payments table').DataTable({
        "order": [[0, "desc"]]
    });

    // 2. Custom Filtering logic for Date Ranges
    $.fn.dataTable.ext.search.push(
        function(settings, data, dataIndex) {
            var from = $('#date_from').val();
            var to = $('#date_to').val();
            
            // Convert d-m-Y from the first column to a JS Date object
            var dateParts = data[0].split("-");
            if(dateParts.length !== 3) return true; // Skip if date format is unexpected
            
            var rowDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
            var min = from ? new Date(from) : null;
            var max = to ? new Date(to) : null;

            if (min) min.setHours(0,0,0,0);
            if (max) max.setHours(23,59,59,999);

            if (
                (min === null && max === null) ||
                (min === null && rowDate <= max) ||
                (min <= rowDate && max === null) ||
                (min <= rowDate && rowDate <= max)
            ) {
                return true;
            }
            return false;
        }
    );

    // 3. Filter Actions
    $('#filter_dates').click(function(){
        repairTable.draw();
        paymentTable.draw();
    });

    $('#reset_filter').click(function(){
        $('#date_from').val('');
        $('#date_to').val('');
        repairTable.draw();
        paymentTable.draw();
    });

    // 4. Client & Payment Management Actions
    $('.edit_client').click(function(){
        uni_modal("<i class='fa fa-edit'></i> Edit Client Details", "clients/manage_client.php?id=" + $(this).attr('data-id'), 'mid-large');
    });

    $('.edit_payment').click(function(){
        var _id = $(this).data('id');
        uni_modal("Edit Payment Details", "clients/edit_payment.php?id=" + _id);
    });

    $('.delete_payment').click(function(){
        var _id = $(this).data('id');
        if(confirm("Are you sure you want to delete this payment record?")){
            location.href = "clients/delete_payment.php?id=" + _id;
        }
    });
});
</script>