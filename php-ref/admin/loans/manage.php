<?php
// loans/manage.php - Add/Edit Loan Form (content for admin panel)
require_once(__DIR__ . '/../../config.php');

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$client_id = isset($_GET['client_id']) ? intval($_GET['client_id']) : 0;

$loan = null;
if($id > 0){
    $loan = $conn->query("SELECT * FROM client_loans WHERE id = $id")->fetch_assoc();
    if(!$loan) die("Loan not found");
    $client_id = $loan['client_id'];
}
?>

<div class="content py-3">
    <div class="card card-outline card-primary shadow-sm">
        <div class="card-header">
            <h3 class="card-title"><i class="fa fa-hand-holding-usd"></i> <?php echo $id ? 'Edit Loan' : 'New Loan' ?></h3>
            <div class="card-tools">
                <a href="./?page=loans" class="btn btn-default btn-sm border"><i class="fa fa-angle-left"></i> Back to List</a>
            </div>
        </div>
        <div class="card-body">
            <form id="loan-form">
                <input type="hidden" name="id" value="<?php echo $id ?>">
                
                <div class="form-group">
                    <label for="client_id">Client <span class="text-danger">*</span></label>
                    <select name="client_id" id="client_id" class="form-control select2" required>
                        <option value="">-- Select Client --</option>
                        <?php
                        $clients = $conn->query("SELECT id, firstname, middlename, lastname FROM client_list WHERE delete_flag = 0 ORDER BY firstname");
                        while($c = $clients->fetch_assoc()):
                            $selected = ($c['id'] == $client_id) ? 'selected' : '';
                        ?>
                        <option value="<?php echo $c['id'] ?>" <?php echo $selected ?>><?php echo $c['firstname'].' '.$c['middlename'].' '.$c['lastname'] ?></option>
                        <?php endwhile; ?>
                    </select>
                </div>

                <div class="form-group">
                    <label for="loan_date">Loan Date <span class="text-danger">*</span></label>
                    <input type="date" name="loan_date" id="loan_date" class="form-control" value="<?php echo $loan ? $loan['loan_date'] : date('Y-m-d') ?>" required>
                </div>

                <!-- New Fields for Calculation -->
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label for="principal_amount">Principal Amount (₹) <span class="text-danger">*</span></label>
                            <input type="number" step="0.01" name="principal_amount" id="principal_amount" class="form-control" value="<?php echo $loan['principal_amount'] ?? '' ?>" required>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label for="interest_rate">Interest Rate (% per annum) <span class="text-danger">*</span></label>
                            <input type="number" step="0.01" min="0" name="interest_rate" id="interest_rate" class="form-control" value="<?php echo $loan['interest_rate'] ?? '' ?>" required>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label for="loan_period">Loan Period (Months) <span class="text-danger">*</span></label>
                            <input type="number" min="1" name="loan_period" id="loan_period" class="form-control" value="<?php echo $loan['loan_period'] ?? '' ?>" required>
                        </div>
                    </div>
                </div>

                <!-- Calculated Fields (Read-Only) -->
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Total Payable (Principal + Interest)</label>
                            <div class="input-group">
                                <div class="input-group-prepend"><span class="input-group-text">₹</span></div>
                                <input type="text" id="total_payable_display" class="form-control" readonly value="<?php echo $loan ? number_format($loan['total_payable'],2) : '' ?>">
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>EMI Amount (per month)</label>
                            <div class="input-group">
                                <div class="input-group-prepend"><span class="input-group-text">₹</span></div>
                                <input type="text" id="emi_display" class="form-control" readonly value="<?php echo $loan ? number_format($loan['emi_amount'],2) : '' ?>">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Hidden fields to store calculated values -->
                <input type="hidden" name="total_payable" id="total_payable_hidden" value="<?php echo $loan['total_payable'] ?? '' ?>">
                <input type="hidden" name="emi_amount" id="emi_hidden" value="<?php echo $loan['emi_amount'] ?? '' ?>">

                <div class="form-group">
                    <label for="remarks">Purpose / Remarks</label>
                    <textarea name="remarks" id="remarks" class="form-control" rows="2"><?php echo $loan['remarks'] ?? '' ?></textarea>
                </div>

                <div class="form-group">
                    <label for="status">Status</label>
                    <select name="status" id="status" class="form-control">
                        <option value="1" <?php echo ($loan && $loan['status']==1) ? 'selected' : '' ?>>Active</option>
                        <option value="0" <?php echo ($loan && $loan['status']==0) ? 'selected' : '' ?>>Closed</option>
                    </select>
                </div>
            </form>
        </div>
        <div class="card-footer">
            <button type="button" id="save-loan-btn" class="btn btn-primary"><i class="fa fa-save"></i> Save Loan</button>
            <a href="./?page=loans" class="btn btn-default">Cancel</a>
        </div>
    </div>
</div>

<!-- Auto Calculation Script -->
<script>
$(function(){
    // Select2
    if ($.fn.select2) {
        $('.select2').select2({ width: '100%', placeholder: '-- Select Client --' });
    }

    // Calculate function
    function calculateLoan() {
        var principal = parseFloat($('#principal_amount').val()) || 0;
        var rate = parseFloat($('#interest_rate').val()) || 0;
        var months = parseInt($('#loan_period').val()) || 0;

        if (principal > 0 && rate >= 0 && months > 0) {
            // Simple interest calculation
            var interest = principal * (rate / 100) * (months / 12);
            var total = principal + interest;
            var emi = total / months;

            $('#total_payable_display').val('₹ ' + total.toFixed(2));
            $('#emi_display').val('₹ ' + emi.toFixed(2));
            $('#total_payable_hidden').val(total.toFixed(2));
            $('#emi_hidden').val(emi.toFixed(2));
        } else {
            $('#total_payable_display').val('');
            $('#emi_display').val('');
            $('#total_payable_hidden').val('');
            $('#emi_hidden').val('');
        }
    }

    $('#principal_amount, #interest_rate, #loan_period').on('input', calculateLoan);
    calculateLoan();

    // AJAX form submission using FormData (like manage_loan.php)
    $('#save-loan-btn').on('click', function(e){
        e.preventDefault();

        // Validation
        var client = $('#client_id').val();
        var principal = parseFloat($('#principal_amount').val());
        var rate = parseFloat($('#interest_rate').val());
        var months = parseInt($('#loan_period').val());
        var total = parseFloat($('#total_payable_hidden').val());

        if(!client){
            alert_toast('Please select a client', 'error');
            return false;
        }
        if(principal <= 0){
            alert_toast('Principal amount must be greater than zero', 'error');
            return false;
        }
        if(rate < 0){
            alert_toast('Interest rate cannot be negative', 'error');
            return false;
        }
        if(months < 1){
            alert_toast('Loan period must be at least 1 month', 'error');
            return false;
        }
        if(total <= 0){
            alert_toast('Total payable could not be calculated. Check inputs.', 'error');
            return false;
        }

        // Create FormData
        var formData = new FormData($('#loan-form')[0]);

        start_loader();
        $.ajax({
            url: _base_url_ + "classes/Master.php?f=save_client_loan",
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            method: 'POST',
            type: 'POST',
            dataType: 'json',
            error: function(xhr, status, error){
                console.log(xhr);
                alert_toast("Error: " + xhr.responseText, 'error');
                end_loader();
            },
            success: function(resp){
                if(resp.status == 'success'){
                    alert_toast("Loan saved successfully.", 'success');
                    setTimeout(function(){
                        location.href = "./?page=loans";
                    }, 1500);
                } else {
                    alert_toast("Error: " + (resp.msg || 'Unknown error'), 'error');
                    end_loader();
                }
            }
        });
    });
});
</script>