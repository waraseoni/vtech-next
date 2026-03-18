<?php
// loans/view.php - Loan Details with Payment History
require_once(__DIR__ . '/../../config.php');

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if (!$id) {
    echo '<script>alert("Invalid Loan ID"); location.replace("./?page=loans");</script>';
    exit;
}

$loan = $conn->query("SELECT l.*, 
                      c.firstname, c.middlename, c.lastname, c.contact, c.email, c.address, c.image_path
                      FROM client_loans l 
                      JOIN client_list c ON l.client_id = c.id 
                      WHERE l.id = $id")->fetch_assoc();
if (!$loan) {
    echo '<script>alert("Loan not found"); location.replace("./?page=loans");</script>';
    exit;
}

$client_name = trim($loan['firstname'] . ' ' . ($loan['middlename'] ? $loan['middlename'] . ' ' : '') . $loan['lastname']);
$loan_id_display = 'LN-' . str_pad($id, 5, '0', STR_PAD_LEFT);

$payments = $conn->query("SELECT * FROM client_payments WHERE loan_id = $id ORDER BY payment_date DESC");
$paid_sum = $conn->query("SELECT SUM(amount + discount) as total FROM client_payments WHERE loan_id = $id")->fetch_assoc()['total'] ?? 0;
$balance = $loan['total_payable'] - $paid_sum;

$status_badge = $loan['status'] == 1 ?
    '<span class="badge badge-success px-3 py-2">Active</span>' :
    '<span class="badge badge-secondary px-3 py-2">Closed</span>';
?>

<div class="content py-3">
    <div class="card card-outline card-primary shadow-sm">
        <div class="card-header">
            <div class="d-flex flex-wrap align-items-center">
                <div class="image-wrapper mr-4 mb-3 mb-md-0">
                    <img src="<?php echo validate_image($loan['image_path']) ?>"
                         alt="Client Image"
                         class="img-thumbnail view_image_full"
                         style="width: 100px; height: 100px; object-fit: cover; border-radius: 12px; border: 3px solid #fff; cursor: pointer;"
                         data-src="<?php echo validate_image($loan['image_path']) ?>"
                         onerror="this.src='<?php echo base_url ?>dist/img/no-image-available.png'">
                </div>

                <div class="flex-grow-1">
                    <h3 class="card-title" style="font-size: 1.8rem; font-weight: 700; display: block; float: none; margin-bottom: 5px;">
                        <?php echo $loan_id_display ?>
                    </h3>

                    <div class="text-muted mb-2">
                        <i class="fa fa-user"></i> <b>Client:</b>
                        <a href="./?page=clients/view_client&id=<?php echo $loan['client_id'] ?>" class="text-primary">
                            <?php echo $client_name ?>
                        </a>
                        | <i class="fa fa-phone-alt"></i> <?php echo $loan['contact'] ?: 'N/A' ?>
                        | <i class="fa fa-map-marker-alt"></i> <?php echo $loan['address'] ?: 'N/A' ?>
                    </div>

                    <div class="d-flex flex-wrap" style="gap: 10px;">
                        <?php echo $status_badge ?>
                        <span class="badge badge-info p-2"><i class="fa fa-calendar"></i> Loan Date: <?php echo date("d-m-Y", strtotime($loan['loan_date'])) ?></span>
                        <?php if (!empty($loan['remarks'])): ?>
                            <span class="badge badge-secondary p-2"><i class="fa fa-sticky-note"></i> Remarks: <?php echo $loan['remarks'] ?></span>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="card-tools mt-3 mt-md-0">
                    <a href="./?page=loans" class="btn btn-default btn-sm border"><i class="fa fa-angle-left"></i> Back to List</a>
                    <a href="./?page=loans/manage&id=<?php echo $id ?>" class="btn btn-primary btn-sm"><i class="fa fa-edit"></i> Edit</a>
                    <button type="button" class="btn btn-success btn-sm" data-toggle="modal" data-target="#emiPaymentModal" onclick="clearPaymentModal()">
                        <i class="fa fa-plus"></i> Add EMI Payment
                    </button>
                    <button type="button" class="btn btn-info btn-sm" onclick="printLoanStatement()"><i class="fa fa-print"></i> Print Statement</button>
                </div>
            </div>
        </div>

        <div class="card-body">
            <div class="container-fluid">
                <div class="row mb-4">
                    <div class="col-md-3 col-6">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Total Payable</span>
                                <span class="info-box-number text-primary">₹<?= number_format($loan['total_payable'], 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Total Paid</span>
                                <span class="info-box-number text-success">₹<?= number_format($paid_sum, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Current Balance</span>
                                <span class="info-box-number <?php echo $balance > 0 ? 'text-danger' : 'text-success' ?>">
                                    ₹<?= number_format($balance, 2) ?>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">EMI Amount</span>
                                <span class="info-box-number text-warning">₹<?= number_format($loan['emi_amount'], 2) ?></span>
                            </div>
                        </div>
                    </div>
                </div>

                <?php if ($loan['principal_amount'] > 0 || $loan['interest_rate'] > 0 || $loan['loan_period'] > 0): ?>
                <div class="row mb-4">
                    <div class="col-md-12">
                        <div class="card card-outline card-info">
                            <div class="card-header">
                                <h5 class="card-title"><i class="fa fa-calculator"></i> Loan Calculation Details</h5>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-md-3"><strong>Principal:</strong> ₹<?= number_format($loan['principal_amount'], 2) ?></div>
                                    <div class="col-md-3"><strong>Interest Rate:</strong> <?= $loan['interest_rate'] ?>% p.a.</div>
                                    <div class="col-md-3"><strong>Period:</strong> <?= $loan['loan_period'] ?> months</div>
                                    <div class="col-md-3"><strong>EMI:</strong> ₹<?= number_format($loan['emi_amount'], 2) ?></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <?php endif; ?>

                <div class="card card-outline card-secondary">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fa fa-history"></i> Payment History</h3>
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

                        <table class="table table-hover table-striped table-bordered" id="payment-table">
                            <thead class="bg-navy">
                                <tr>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Discount</th>
                                    <th>Net Amount</th>
                                    <th>Payment Mode</th>
                                    <th>Remarks</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php while ($p = $payments->fetch_assoc()): ?>
                                    <tr>
                                        <td data-order="<?= date("Ymd", strtotime($p['payment_date'])) ?>">
                                            <?= date("d-m-Y", strtotime($p['payment_date'])) ?>
                                        </td>
                                        <td class="text-right">₹<?= number_format($p['amount'], 2) ?></td>
                                        <td class="text-right">₹<?= number_format($p['discount'], 2) ?></td>
                                        <td class="text-right text-success">₹<?= number_format($p['amount'] + $p['discount'], 2) ?></td>
                                        <td><?= $p['payment_mode'] ?></td>
                                        <td><?= $p['remarks'] ?></td>
                                        <td class="text-center">
                                            <button type="button" class="btn btn-sm btn-info edit-payment" data-id="<?= $p['id'] ?>"><i class="fa fa-edit"></i></button>
                                            <button type="button" class="btn btn-sm btn-danger delete-payment" data-id="<?= $p['id'] ?>"><i class="fa fa-trash"></i></button>
                                        </td>
                                    </tr>
                                <?php endwhile; ?>
                                <?php if ($payments->num_rows == 0): ?>
                                    <tr>
                                        <td colspan="7" class="text-center">No payments recorded yet.</td>
                                    </tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- EMI Payment Modal (for Add/Edit) -->
<div class="modal fade" id="emiPaymentModal" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="paymentModalTitle">Record EMI Payment</h5>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>
            <form id="emi-payment-form" onsubmit="return false;">
                <div class="modal-body">
                    <input type="hidden" name="id" id="payment_id" value="">
                    <input type="hidden" name="loan_id" value="<?php echo $id ?>">
                    <input type="hidden" name="client_id" value="<?php echo $loan['client_id'] ?>">

                    <div class="row">
                        <div class="col-md-4 form-group">
                            <label>Amount Received (₹) <span class="text-danger">*</span></label>
                            <input type="number" step="0.01" name="amount" id="edit_amount" class="form-control" required>
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Discount (if any)</label>
                            <input type="number" step="0.01" name="discount" id="edit_discount" class="form-control" value="0">
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Payment Date <span class="text-danger">*</span></label>
                            <input type="date" name="payment_date" id="edit_payment_date" class="form-control" value="<?php echo date('Y-m-d') ?>" required>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6 form-group">
                            <label>Payment Mode <span class="text-danger">*</span></label>
                            <select name="payment_mode" id="edit_payment_mode" class="form-control" required>
                                <option>Cash</option>
                                <option>PhonePe/GPay</option>
                                <option>Bank Transfer</option>
                                <option>Cheque</option>
                            </select>
                        </div>
                        <div class="col-md-6 form-group">
                            <label>Remarks</label>
                            <input type="text" name="remarks" id="edit_remarks" class="form-control" placeholder="Optional">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="saveEMIPayment()" class="btn btn-primary" id="paymentModalSaveBtn"><i class="fa fa-save"></i> Save Payment</button>
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Image Preview Modal -->
<div class="modal fade" id="imagePreviewModal" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="background: transparent; border: none;">
            <div class="modal-body text-center">
                <button type="button" class="close" data-dismiss="modal" style="color: #fff; font-size: 2rem; position: absolute; right: 10px; top: -40px;">&times;</button>
                <img src="" id="preview-img" class="img-fluid rounded shadow-lg" style="max-height: 80vh;">
            </div>
        </div>
    </div>
</div>

<style>
    @media (max-width: 768px) {
        .image-wrapper {
            margin-right: 0 !important;
            text-align: center;
            width: 100%;
        }
        .card-tools {
            width: 100%;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 5px;
        }
        .card-tools .btn {
            flex: 1 1 auto;
            font-size: 12px;
        }
    }
    .info-box-number {
        font-size: 1.2rem;
    }
    @media (max-width: 576px) {
        .info-box-number {
            font-size: 1rem;
        }
    }
</style>

<script>
function saveEMIPayment() {
    var formData = $('#emi-payment-form').serialize();
    start_loader();
    $.ajax({
        url: _base_url_ + 'classes/Master.php?f=save_payment',
        method: 'POST',
        data: formData,
        dataType: 'json',
        success: function(resp){
            if(resp.status == 'success'){
                alert_toast('Payment saved successfully.', 'success');
                setTimeout(function(){ location.reload(); }, 1500);
            } else {
                alert_toast('Error: ' + (resp.msg || 'Unknown error'), 'error');
                end_loader();
            }
        },
        error: function(xhr, status, error){
            console.log(xhr.responseText);
            alert_toast('AJAX error: ' + error, 'error');
            end_loader();
        }
    });
}

function clearPaymentModal() {
    $('#payment_id').val('');
    $('#edit_amount').val('');
    $('#edit_discount').val('0');
    $('#edit_payment_date').val('<?php echo date('Y-m-d') ?>');
    $('#edit_payment_mode').val('Cash');
    $('#edit_remarks').val('');
    $('#paymentModalTitle').text('Record EMI Payment');
    $('#paymentModalSaveBtn').html('<i class="fa fa-save"></i> Save Payment');
}

function editPayment(id) {
    start_loader();
    $.ajax({
        url: _base_url_ + 'classes/Master.php?f=get_payment',
        method: 'GET',
        data: {id: id},
        dataType: 'json',
        success: function(resp){
            if(resp.status == 'success'){
                $('#payment_id').val(resp.data.id);
                $('#edit_amount').val(resp.data.amount);
                $('#edit_discount').val(resp.data.discount);
                $('#edit_payment_date').val(resp.data.payment_date);
                $('#edit_payment_mode').val(resp.data.payment_mode);
                $('#edit_remarks').val(resp.data.remarks);
                $('#paymentModalTitle').text('Edit EMI Payment');
                $('#paymentModalSaveBtn').html('<i class="fa fa-save"></i> Update Payment');
                $('#emiPaymentModal').modal('show');
            } else {
                alert_toast('Error: ' + (resp.msg || 'Unknown error'), 'error');
            }
            end_loader();
        },
        error: function(xhr, status, error){
            console.log(xhr.responseText);
            alert_toast('AJAX error: ' + error, 'error');
            end_loader();
        }
    });
}

function deletePayment(id) {
    if(confirm('Are you sure you want to delete this payment?')){
        start_loader();
        $.ajax({
            url: _base_url_ + 'classes/Master.php?f=delete_payment',
            method: 'POST',
            data: {id: id},
            dataType: 'json',
            success: function(resp){
                if(resp.status == 'success'){
                    alert_toast('Payment deleted successfully.', 'success');
                    setTimeout(function(){ location.reload(); }, 1500);
                } else {
                    alert_toast('Error: ' + (resp.msg || 'Unknown error'), 'error');
                    end_loader();
                }
            },
            error: function(xhr, status, error){
                console.log(xhr.responseText);
                alert_toast('AJAX error: ' + error, 'error');
                end_loader();
            }
        });
    }
}

$(function(){
    var paymentTable = $('#payment-table').DataTable({
        "order": [[0, "desc"]],
        "pageLength": 25,
        "columnDefs": [
            { "type": "num", "targets": [1,2,3] }
        ]
    });

    $.fn.dataTable.ext.search.push(function(settings, data, dataIndex) {
        var from = $('#date_from').val();
        var to = $('#date_to').val();
        var dateParts = data[0].split("-");
        if (dateParts.length !== 3) return true;
        var rowDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        var min = from ? new Date(from) : null;
        var max = to ? new Date(to) : null;
        if (min) min.setHours(0, 0, 0, 0);
        if (max) max.setHours(23, 59, 59, 999);
        if (
            (min === null && max === null) ||
            (min === null && rowDate <= max) ||
            (min <= rowDate && max === null) ||
            (min <= rowDate && rowDate <= max)
        ) return true;
        return false;
    });

    $('#filter_dates').click(function(){
        paymentTable.draw();
    });

    $('#reset_filter').click(function(){
        $('#date_from').val('');
        $('#date_to').val('');
        paymentTable.draw();
    });

    $(document).on('click', '.view_image_full', function(){
        var imgPath = $(this).attr('data-src');
        $('#preview-img').attr('src', imgPath);
        $('#imagePreviewModal').modal('show');
    });

    $(document).on('click', '.edit-payment', function(){
        var id = $(this).data('id');
        editPayment(id);
    });

    $(document).on('click', '.delete-payment', function(){
        var id = $(this).data('id');
        deletePayment(id);
    });

    $('#emiPaymentModal').on('show.bs.modal', function(e) {
        if($(e.relatedTarget).hasClass('btn-success')) {
            clearPaymentModal();
        }
    });
});

function printLoanStatement() {
    alert_toast("Print functionality will be added soon.", "info");
}
</script>