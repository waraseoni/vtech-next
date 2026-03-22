<?php
require_once('../../config.php');

// Client ID check karna
if(isset($_GET['client_id']) && $_GET['client_id'] > 0){
    $client_id = $_GET['client_id'];
} else {
    echo "Invalid Client ID";
    exit;
}
?>
<div class="container-fluid">
    <form action="" id="loan-form">
        <input type="hidden" name="client_id" value="<?php echo $client_id ?>">
        
        <div class="form-group">
            <label for="principal_amount" class="control-label">Loan/Advance Amount (Mool Dhan)</label>
            <input type="number" step="any" name="principal_amount" id="principal_amount" class="form-control text-right" required>
        </div>

        <div class="row">
            <div class="col-md-6">
                <div class="form-group">
                    <label for="interest_rate" class="control-label">Interest Rate (%)</label>
                    <input type="number" step="any" name="interest_rate" id="interest_rate" class="form-control text-right" value="0">
                    <small class="text-muted">Yadi byaj nahi lena to 0 rakhein.</small>
                </div>
            </div>
            <div class="col-md-6">
                <div class="form-group">
                    <label for="months" class="control-label">Kist ki Avadhi (Months)</label>
                    <input type="number" name="months" id="months" class="form-control text-right" value="1" min="1" required>
                </div>
            </div>
        </div>

        <hr>

        <div class="row">
            <div class="col-md-6">
                <div class="form-group">
                    <label class="control-label">Total Payable (Byaj Sahit)</label>
                    <input type="text" id="total_payable_display" class="form-control text-right" readonly>
                    <input type="hidden" name="total_payable" id="total_payable">
                </div>
            </div>
            <div class="col-md-6">
                <div class="form-group">
                    <label class="control-label">Monthly EMI (Masik Kist)</label>
                    <input type="text" id="emi_amount_display" class="form-control text-right text-danger font-weight-bold" readonly>
                    <input type="hidden" name="emi_amount" id="emi_amount">
                </div>
            </div>
        </div>

        <div class="form-group">
            <label for="loan_date" class="control-label">Loan Dene ki Tarikh</label>
            <input type="date" name="loan_date" id="loan_date" class="form-control" value="<?php echo date('Y-m-d') ?>" required>
        </div>
    </form>
</div>

<script>
    $(function(){
        // Calculation Logic
        function calculateLoan(){
            var principal = $('#principal_amount').val() != "" ? parseFloat($('#principal_amount').val()) : 0;
            var interest_rate = $('#interest_rate').val() != "" ? parseFloat($('#interest_rate').val()) : 0;
            var months = $('#months').val() != "" ? parseInt($('#months').val()) : 1;

            // Simple Interest Calculation: Total = P + (P * R / 100)
            var total_interest = principal * (interest_rate / 100);
            var total_payable = principal + total_interest;
            var emi = total_payable / months;

            $('#total_payable').val(total_payable.toFixed(2));
            $('#total_payable_display').val(new Intl.NumberFormat().format(total_payable.toFixed(2)));
            
            $('#emi_amount').val(emi.toFixed(2));
            $('#emi_amount_display').val(new Intl.NumberFormat().format(emi.toFixed(2)));
        }

        // Event Listeners for auto-calculation
        $('#principal_amount, #interest_rate, #months').on('input change', function(){
            calculateLoan();
        });

        // Form Submission
        $('#loan-form').submit(function(e){
            e.preventDefault();
            var _this = $(this);
            $('.err-msg').remove();
            start_loader();
            $.ajax({
                url: _base_url_ + "classes/Master.php?f=save_client_loan",
                data: new FormData($(this)[0]),
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                type: 'POST',
                dataType: 'json',
                error: err => {
                    console.log(err);
                    alert_toast("An error occurred", 'error');
                    end_loader();
                },
                success: function(resp){
                    if(typeof resp == 'object' && resp.status == 'success'){
                        location.reload();
                    } else if(resp.status == 'failed' && !!resp.msg){
                        var el = $('<div>').addClass("alert alert-danger err-msg").text(resp.msg);
                        _this.prepend(el);
                        el.show('slow');
                        $("html, body").animate({ scrollTop: 0 }, "fast");
                    } else {
                        alert_toast("An error occurred", 'error');
                    }
                    end_loader();
                }
            })
        })
    })
</script>