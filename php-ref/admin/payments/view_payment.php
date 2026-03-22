<?php
require_once('../../config.php');
if(isset($_GET['id']) && $_GET['id'] > 0){
    // Fetch Payment and Client details
    $qry = $conn->query("SELECT p.*, c.firstname, c.lastname, c.contact, c.address 
                         FROM `client_payments` p 
                         INNER JOIN `client_list` c ON p.client_id = c.id 
                         WHERE p.id = '{$_GET['id']}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){
            $$k=$v;
        }
    }
}
?>
<style>
    #uni_modal .modal-footer { display: none; }
    .payment-id-tag { font-size: 1.2rem; font-weight: bold; color: #001f3f; }
</style>

<div class="container-fluid" id="printout">
    <div class="row mb-3">
        <div class="col-12 d-flex justify-content-between align-items-top">
            <div>
                <h4 class="mb-0 text-primary">V-Technologies</h4>
                <p class="text-muted small">Payment Receipt</p>
            </div>
            <div class="text-right">
                <span class="payment-id-tag">PY-<?= str_pad($id, 4, '0', STR_PAD_LEFT) ?></span><br>
                <span class="text-muted small">Date: <?= date("M d, Y", strtotime($payment_date)) ?></span>
            </div>
        </div>
    </div>

    <div class="row mb-4">
        <div class="col-6">
            <p class="mb-0 text-muted">Received From:</p>
            <h5 class="mb-0 font-weight-bold"><?= ucwords($firstname.' '.$lastname) ?></h5>
            <p class="small text-muted mb-0"><?= $contact ?></p>
            <p class="small text-muted"><?= $address ?></p>
        </div>
        <div class="col-6 text-right">
            <p class="mb-0 text-muted">Payment Mode:</p>
            <span class="badge badge-info px-3 rounded-pill"><?= $payment_mode ?></span>
        </div>
    </div>

    <table class="table table-bordered">
        <thead>
            <tr class="bg-light">
                <th>Description</th>
                <th class="text-right">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Payment Received</td>
                <td class="text-right font-weight-bold">₹<?= number_format($amount, 2) ?></td>
            </tr>
            <?php if($discount > 0): ?>
            <tr>
                <td class="text-italic">Discount Applied</td>
                <td class="text-right text-danger">- ₹<?= number_format($discount, 2) ?></td>
            </tr>
            <?php endif; ?>
        </tbody>
        <tfoot>
            <tr class="bg-navy text-white">
                <th class="text-uppercase">Total Settled Amount</th>
                <th class="text-right">₹<?= number_format($amount + $discount, 2) ?></th>
            </tr>
        </tfoot>
    </table>

    <div class="mt-4 pt-2 border-top text-center">
        <p class="text-muted small">This is a computer-generated receipt.</p>
    </div>
</div>

<div class="text-right mt-3">
    <button class="btn btn-sm btn-flat btn-success" type="button" id="print_receipt"><i class="fa fa-print"></i> Print</button>
    <button class="btn btn-sm btn-flat btn-secondary" type="button" data-dismiss="modal">Close</button>
</div>

<script>
    $(function(){
        $('#print_receipt').click(function(){
            var _h = $('head').clone()
            var _p = $('#printout').clone()
            var _el = $('<div>')
            _h.find('title').text("Payment Receipt - PY-<?= str_pad($id, 4, '0', STR_PAD_LEFT) ?>")
            _el.append(_h)
            _el.append('<h3 class="text-center">PAYMENT RECEIPT</h3>')
            _el.append(_p)
            var nw = window.open("","","width=800,height=600,left=200,top=100")
            nw.document.write(_el.html())
            nw.document.close()
            setTimeout(() => {
                nw.print()
                setTimeout(() => {
                    nw.close()
                }, 300);
            }, 500);
        })
    })
</script>