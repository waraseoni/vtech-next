<?php if($_settings->chk_flashdata('success')): ?>
<script>
	alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')
</script>
<?php endif;?>

<?php 
$month = isset($_GET['month']) ? $_GET['month'] : date("Y-m");  // Format: YYYY-MM
?>

<div class="card card-outline rounded-0 card-navy">
	<div class="card-header">
		<h3 class="card-title">Monthly Sales Report</h3>
	</div>
	<div class="card-body">
		<div class="container-fluid mb-3">
            <fieldset class="px-2 py-1 border">
                <legend class="w-auto px-3">Filter</legend>
                <div class="container-fluid">
                    <form action="" id="filter-form">
                        <div class="row align-items-end">
                            <div class="col-lg-4 col-md-6 col-sm-12 col-xs-12">
                                <div class="form-group">
                                    <label for="month" class="control-label">Choose Month</label>
                                    <input type="month" class="form-control form-control-sm rounded-0" name="month" id="month" value="<?= $month ?>" required>
                                </div>
                            </div>
                            <div class="col-lg-4 col-md-6 col-sm-12 col-xs-12">
                                <div class="form-group">
                                    <button class="btn btn-primary btn-sm bg-gradient-primary rounded-0"><i class="fa fa-filter"></i> Filter</button>
                                    <button class="btn btn-light btn-sm bg-gradient-light rounded-0 border" type="button" id="print"><i class="fa fa-print"></i> Print</button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </fieldset>
		</div>

        <div class="container-fluid" id="printout">
			<table class="table table-hover table-striped table-bordered">
				<colgroup>
					<col width="5%">
					<col width="15%">
					<col width="20%">
					<col width="30%">
					<col width="10%">
					<col width="10%">
					<col width="10%">
				</colgroup>
				<thead>
					<tr>
						<th>#</th>
						<th>Date</th>
						<th>Code / Client</th>
						<th>Product Name</th>
						<th>Price</th>
						<th>Qty</th>
						<th>Total</th>
					</tr>
				</thead>
				<tbody>
					<?php 
                    $total = 0;
					$i = 1;
                    $qry = $conn->query("SELECT tp.*, tl.code, 
                        CONCAT(c.firstname, ' ', IFNULL(c.middlename,''), ' ', c.lastname) as client_full_name,
                        pl.name as product,
                        tl.date_updated 
                    FROM `transaction_products` tp 
                    INNER JOIN transaction_list tl ON tp.transaction_id = tl.id 
                    INNER JOIN product_list pl ON tp.product_id = pl.id 
                    INNER JOIN client_list c ON tl.client_name = c.id 
                    WHERE tl.status != 4 
                      AND DATE_FORMAT(tl.date_updated, '%Y-%m') = '{$month}'
                    ORDER BY tl.date_updated ASC");

                    while($row = $qry->fetch_assoc()):
                        $row_total = $row['price'] * $row['qty'];
                        $total += $row_total;
					?>
						<tr>
							<td class="text-center"><?php echo $i++; ?></td>
							<td><?= date("M d, Y H:i", strtotime($row['date_updated'])) ?></td>
							<td>
                                <div style="line-height:1em">
                                    <div><small><?= htmlspecialchars($row['code']) ?></small></div>
                                    <div><small><?= htmlspecialchars($row['client_full_name']) ?></small></div>
                                </div>
                            </td>
							<td><?= htmlspecialchars($row['product']) ?></td>
							<td class='text-right'><?= format_num($row['price']) ?></td>
							<td class='text-right'><?= format_num($row['qty']) ?></td>
							<td class='text-right'><?= format_num($row_total) ?></td>
						</tr>
					<?php endwhile; ?>
				</tbody>
                <tfoot>
                    <th class="py-1 text-center" colspan="6">Total Monthly Sales</th>
                    <th class="py-1 text-right"><?= format_num($total, 2) ?></th>
                </tfoot>
			</table>
		</div>
	</div>
</div>

<noscript id="print-header">
    <div>
    <div class="d-flex w-100">
        <div class="col-2 text-center">
            <img style="height:.8in;width:.8in!important;object-fit:cover;object-position:center center" src="<?= validate_image($_settings->info('logo')) ?>" alt="" class="w-100 img-thumbnail rounded-circle">
        </div>
        <div class="col-8 text-center">
            <div style="line-height:1em">
                <h4 class="text-center mb-0"><?= $_settings->info('name') ?></h4>
                <h3 class="text-center mb-0"><b>Monthly Sales Report</b></h3>
                <div class="text-center">for the month of</div>
                <h4 class="text-center mb-0"><b><?= date("F Y", strtotime($month . "-01")) ?></b></h4>
            </div>
        </div>
    </div>
    <hr>
    </div>
</noscript>

<script>
	$(document).ready(function(){
		$('#filter-form').submit(function(e){
            e.preventDefault();
            location.href = "./?page=reports/monthly_sales_report&" + $(this).serialize();
        });

        $('#print').click(function(){
            var h = $('head').clone();
            var ph = $($('noscript#print-header').html()).clone();
            var p = $('#printout').clone();
            h.find('title').text('Monthly Sales Report - Print View');

            start_loader();
            var nw = window.open("", "_blank", "width=" + ($(window).width() * .8) + ",height=" + ($(window).height() * .8) + ",left=" + ($(window).width() * .1) + ",top=" + ($(window).height() * .1));
            nw.document.querySelector('head').innerHTML = h.html();
            nw.document.querySelector('body').innerHTML = ph.html();
            nw.document.querySelector('body').innerHTML += p[0].outerHTML;
            nw.document.close();

            setTimeout(() => {
                nw.print();
                setTimeout(() => {
                    nw.close();
                    end_loader();
                }, 300);
            }, 500);
        });
	});
</script>