<?php
require_once('../../config.php');
if(isset($_GET['id']) && $_GET['id'] > 0){
    $qry = $conn->query("SELECT * from `lender_list` where id = '{$_GET['id']}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){
            $$k=$v;
        }
    }
}
?>
<div class="container-fluid">
    <form action="" id="lender-form">
        <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
        
        <div class="row">
            <div class="col-md-6">
                <div class="form-group">
                    <label for="fullname" class="control-label">Lender Full Name</label>
                    <input type="text" name="fullname" id="fullname" class="form-control form-control-sm rounded-0" value="<?php echo isset($fullname) ? $fullname : ''; ?>"  required/>
                </div>
                <div class="form-group">
                    <label for="contact" class="control-label">Contact Number</label>
                    <input type="text" name="contact" id="contact" class="form-control form-control-sm rounded-0" value="<?php echo isset($contact) ? $contact : ''; ?>"  required/>
                </div>
                <div class="form-group">
                    <label for="start_date" class="control-label">Loan Start Date</label>
                    <input type="date" name="start_date" id="start_date" class="form-control form-control-sm rounded-0" value="<?php echo isset($start_date) ? $start_date : date('Y-m-d'); ?>"  required/>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="form-group">
                    <label for="loan_amount" class="control-label">Principal Amount (P)</label>
                    <input type="number" step="any" name="loan_amount" id="loan_amount" class="form-control form-control-sm rounded-0 text-right" value="<?php echo isset($loan_amount) ? $loan_amount : 0; ?>" required/>
                </div>
                <div class="form-group">
                    <label for="interest_rate" class="control-label">Interest Rate (% p.a.)</label>
                    <input type="number" step="any" name="interest_rate" id="interest_rate" class="form-control form-control-sm rounded-0 text-right" value="<?php echo isset($interest_rate) ? $interest_rate : 0; ?>" required/>
                </div>
                <div class="form-group">
                    <label for="tenure_months" class="control-label">Tenure (Months)</label>
                    <input type="number" name="tenure_months" id="tenure_months" class="form-control form-control-sm rounded-0 text-right" value="<?php echo isset($tenure_months) ? $tenure_months : 0; ?>" required/>
                </div>
            </div>
        </div>

        <div class="card bg-light mt-3">
            <div class="card-body p-2">
                <div class="row">
                    <div class="col-md-12">
                        <h5 class="text-navy">Calculation Summary:</h5>
                        <div class="d-flex justify-content-between border-bottom">
                            <span>Monthly EMI:</span>
                            <span class="font-weight-bold text-danger">₹ <span id="display_emi">0.00</span></span>
                            <input type="hidden" name="emi_amount" id="emi_amount" value="<?php echo isset($emi_amount) ? $emi_amount : 0; ?>">
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>Total Repayment:</span>
                            <span class="font-weight-bold">₹ <span id="display_total">0.00</span></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
		
		<div class="form-group">
    <label for="reason" class="control-label">Loan Reason / Remarks</label>
    <textarea rows="2" name="reason" id="reason" class="form-control form-control-sm rounded-0"><?php echo isset($reason) ? $reason : ''; ?></textarea>
</div>

        <div class="form-group mt-3">
            <label for="status" class="control-label">Loan Status</label>
            <select name="status" id="status" class="form-control form-control-sm rounded-0" required>
                <option value="1" <?php echo isset($status) && $status == 1 ? 'selected' : '' ?>>Active (Running)</option>
                <option value="2" <?php echo isset($status) && $status == 2 ? 'selected' : '' ?>>Completed (Closed)</option>
            </select>
        </div>
    </form>
</div>

<script>
    // EMI Calculation Logic
    function calculateEMI() {
        let p = parseFloat($('#loan_amount').val()) || 0;
        let r = parseFloat($('#interest_rate').val()) || 0;
        let n = parseFloat($('#tenure_months').val()) || 0;

        if (p > 0 && r > 0 && n > 0) {
            // Formula: Monthly Interest Rate
            let monthlyRate = (r / 12) / 100;
            // EMI Formula: [P x R x (1+R)^N]/[(1+R)^N-1]
            let emi = (p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
            
            let totalRepayment = emi * n;

            $('#display_emi').text(emi.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
            $('#emi_amount').val(emi.toFixed(2));
            $('#display_total').text(totalRepayment.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
        } else {
            $('#display_emi').text('0.00');
            $('#emi_amount').val(0);
            $('#display_total').text('0.00');
        }
    }

    $(document).ready(function(){
        // Input change hote hi calculate karein
        $('#loan_amount, #interest_rate, #tenure_months').on('input', function(){
            calculateEMI();
        });

        // Form Submission
        $('#lender-form').submit(function(e){
            e.preventDefault();
            var _this = $(this)
            $('.err-msg').remove();
            start_loader();
            $.ajax({
                url:_base_url_+"classes/Master.php?f=save_lender",
                data: new FormData($(this)[0]),
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                type: 'POST',
                dataType: 'json',
                error:err=>{
                    console.log(err)
                    alert_toast("An error occured",'error');
                    end_loader();
                },
                success:function(resp){
                    if(typeof resp =='object' && resp.status == 'success'){
                        location.reload();
                    }else if(resp.status == 'failed' && !!resp.msg){
                        var el = $('<div>')
                            el.addClass("alert alert-danger err-msg").text(resp.msg)
                            _this.prepend(el)
                            el.show('slow')
                            $("html, body").animate({ scrollTop: 0 }, "fast");
                            end_loader();
                    }else{
                        alert_toast("An error occured",'error');
                        end_loader();
                        console.log(resp)
                    }
                }
            })
        })

        // Initial Calculation on Load (for Edit mode)
        calculateEMI();
    })
</script>