<DOCUMENT filename="financial_management.php">
<?php
require_once('../config.php');

if(isset($_GET['mode']) && $_GET['mode'] == 'advance_form') {
    // Form code from manage_advance.php
    $mechanic_id_from_url = isset($_GET['mechanic_id']) ? $_GET['mechanic_id'] : '';
    $id = isset($_GET['id']) ? $_GET['id'] : '';
    if($id) {
        $qry = $conn->query("SELECT * FROM advance_payments where id = '{$id}'");
        foreach($qry->fetch_array() as $k => $v){ $$k = $v; }
    }
?>
<div class="container-fluid">
    <form id="advance-form">
        <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
        
        <div class="form-group">
            <label>Staff Member</label>
            <select name="mechanic_id" class="form-control select2" required>
                <option value="" disabled selected>Select Staff</option>
                <?php 
                $staff = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE status = 1 ORDER BY name ASC");
                while($row = $staff->fetch_assoc()): 
                    $is_selected = '';
                    if(isset($mechanic_id) && $mechanic_id == $row['id']){
                        $is_selected = 'selected';
                    } elseif($mechanic_id_from_url == $row['id']){
                        $is_selected = 'selected';
                    }
                ?>
                <option value="<?= $row['id'] ?>" <?= $is_selected ?>><?= $row['name'] ?></option>
                <?php endwhile; ?>
            </select>
        </div>

        <div class="form-group">
            <label>Amount (₹)</label>
            <input type="number" name="amount" class="form-control text-right" value="<?= isset($amount) ? $amount : '' ?>" required>
        </div>
        
        <div class="form-group">
            <label>Date Paid</label>
            <input type="date" name="date_paid" class="form-control" value="<?= isset($date_paid) ? $date_paid : date('Y-m-d') ?>" required>
        </div>
        
        <div class="form-group">
            <label>Reason/Note</label>
            <textarea name="reason" class="form-control" rows="2"><?= isset($reason) ? $reason : '' ?></textarea>
        </div>
    </form>
</div>

<script>
    $(function(){
        if($('.select2').length > 0){
            $('.select2').select2({
                placeholder:"Select Staff",
                width: "100%"
            })
        }

        $('#advance-form').submit(function(e){
            e.preventDefault();
            start_loader();
            $.ajax({
                url: _base_url_ + "classes/Master.php?f=save_advance",
                method: 'POST',
                data: $(this).serialize(),
                dataType: 'json',
                error: err => {
                    console.log(err);
                    alert_toast("An error occurred while saving", 'error');
                    end_loader();
                },
                success: function(resp){
                    if(resp.status == 'success'){
                        alert_toast("Payment Saved Successfully", 'success');
                        setTimeout(function(){
                            location.reload();
                        }, 1000);
                    } else {
                        alert_toast("Error saving entry", 'error');
                        end_loader();
                    }
                }
            })
        })
    })
</script>
<?php
    exit;
}
?>

<div class="card card-outline card-primary">
	<div class="card-header">
		<h3 class="card-title">Financial Management</h3>
	</div>
	<div class="card-body">
		<ul class="nav nav-tabs" id="financialTabs" role="tablist">
			<li class="nav-item" role="presentation">
				<button class="nav-link active" id="expenses-tab" data-toggle="tab" data-target="#expenses" type="button" role="tab" aria-controls="expenses" aria-selected="true">Expenses</button>
			</li>
			<li class="nav-item" role="presentation">
				<button class="nav-link" id="advances-tab" data-toggle="tab" data-target="#advances" type="button" role="tab" aria-controls="advances" aria-selected="false">Staff Advances</button>
			</li>
		</ul>
		<div class="tab-content" id="financialTabsContent">
			<div class="tab-pane fade show active" id="expenses" role="tabpanel" aria-labelledby="expenses-tab">
				<div class="card-tools">
					<button id="add_expense" class="btn btn-flat btn-sm btn-primary"><span class="fas fa-plus"></span> Add New Expense</button>
				</div>
				<!-- Desktop View -->
				<div class="d-none d-md-block">
					<form method="GET" class="mb-3">
						<input type="hidden" name="page" value="financial_management">
						<div class="row">
							<div class="col-md-4">
								<label for="from_date">From Date:</label>
								<input type="date" id="from_date" name="from_date" class="form-control" value="<?php echo isset($_GET['from_date']) ? $_GET['from_date'] : ''; ?>">
							</div>
							<div class="col-md-4">
								<label for="to_date">To Date:</label>
								<input type="date" id="to_date" name="to_date" class="form-control" value="<?php echo isset($_GET['to_date']) ? $_GET['to_date'] : ''; ?>">
							</div>
							<div class="col-md-4 d-flex align-items-end">
								<button type="submit" class="btn btn-primary">Filter</button>
								<a href="?page=financial_management" class="btn btn-secondary ml-2">Reset</a>
							</div>
						</div>
					</form>
					<table class="table table-bordered table-striped">
						<thead>
							<tr>
								<th>Date</th>
								<th>Category</th>
								<th>Amount</th>
								<th>Remarks</th>
								<th>Action</th>
							</tr>
						</thead>
						<tbody>
							<?php 
							$where = '';
							$params = [];
							if (isset($_GET['from_date']) && !empty($_GET['from_date'])) {
								$where .= ' AND date_created >= ?';
								$params[] = $_GET['from_date'] . ' 00:00:00';
							}
							if (isset($_GET['to_date']) && !empty($_GET['to_date'])) {
								$where .= ' AND date_created <= ?';
								$params[] = $_GET['to_date'] . ' 23:59:59';
							}
							$sql = "SELECT * FROM `expense_list` WHERE 1 $where ORDER BY date_created DESC";
							$qry = $conn->prepare($sql);
							if (!empty($params)) {
								$types = str_repeat('s', count($params));
								$qry->bind_param($types, ...$params);
							}
							$qry->execute();
							$result = $qry->get_result();
							$total_amount = 0;
							while($row = $result->fetch_assoc()):
								$total_amount += $row['amount'];
							?>
							<tr>
								<td><?php echo date("Y-m-d H:i",strtotime($row['date_created'])) ?></td>
								<td><?php echo $row['category'] ?></td>
								<td>₹ <?php echo number_format($row['amount'],2) ?></td>
								<td><?php echo $row['remarks'] ?></td>
								<td align="center">
									 <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">Action</button>
									  <div class="dropdown-menu" role="menu">
										<a class="dropdown-item edit_expense" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-edit text-primary"></span> Edit</a>
										<div class="dropdown-divider"></div>
										<a class="dropdown-item delete_expense" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
									  </div>
								</td>
							</tr>
							<?php endwhile; ?>
						</tbody>
						<tfoot>
							<tr>
								<th colspan="2" class="text-right">Total Amount:</th>
								<th>₹ <?php echo number_format($total_amount, 2); ?></th>
								<th colspan="2"></th>
							</tr>
						</tfoot>
					</table>
				</div>

				<!-- Mobile View for Expenses -->
				<div class="d-block d-md-none">
					<form method="GET" class="mb-3">
						<input type="hidden" name="page" value="financial_management">
						<div class="form-group">
							<label for="mobile_from_date">From Date:</label>
							<input type="date" id="mobile_from_date" name="from_date" class="form-control" value="<?php echo isset($_GET['from_date']) ? $_GET['from_date'] : ''; ?>">
						</div>
						<div class="form-group">
							<label for="mobile_to_date">To Date:</label>
							<input type="date" id="mobile_to_date" name="to_date" class="form-control" value="<?php echo isset($_GET['to_date']) ? $_GET['to_date'] : ''; ?>">
						</div>
						<button type="submit" class="btn btn-primary btn-block">Filter by Date</button>
						<a href="?page=financial_management" class="btn btn-secondary btn-block">Reset</a>
					</form>
					<div class="form-group mb-3">
						<label for="mobile_search_exp">Search:</label>
						<input type="text" id="mobile_search_exp" class="form-control" placeholder="Search by category, remarks...">
					</div>
					<div class="card">
						<div class="card-body text-right">
							<strong>Total Amount:</strong> ₹ <?php echo number_format($total_amount, 2); ?>
						</div>
					</div>
					<div id="expense_cards">
						<?php 
						$result->data_seek(0);
						while($row = $result->fetch_assoc()):
						?>
						<div class="card mb-3 expense-card" data-category="<?php echo strtolower($row['category']); ?>" data-remarks="<?php echo strtolower($row['remarks']); ?>">
							<div class="card-header">
								<?php echo date("Y-m-d H:i",strtotime($row['date_created'])) ?>
							</div>
							<div class="card-body">
								<p><strong>Category:</strong> <?php echo $row['category'] ?></p>
								<p><strong>Amount:</strong> ₹ <?php echo number_format($row['amount'],2) ?></p>
								<p><strong>Remarks:</strong> <?php echo $row['remarks'] ?></p>
							</div>
							<div class="card-footer text-center">
								<button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">Action</button>
								<div class="dropdown-menu" role="menu">
									<a class="dropdown-item edit_expense" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-edit text-primary"></span> Edit</a>
									<div class="dropdown-divider"></div>
									<a class="dropdown-item delete_expense" href="javascript:void(0)" data-id="<?php echo $row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
								</div>
							</div>
						</div>
						<?php endwhile; ?>
					</div>
				</div>
			</div>
			<div class="tab-pane fade" id="advances" role="tabpanel" aria-labelledby="advances-tab">
				<div class="card-tools">
					<button id="add_advance" class="btn btn-flat btn-sm btn-primary"><span class="fas fa-plus"></span> Add New Advance</button>
				</div>
				<!-- Desktop View for Advances -->
				<div class="d-none d-md-block">
					<form method="GET" class="mb-3">
						<input type="hidden" name="page" value="financial_management">
						<div class="row">
							<div class="col-md-4">
								<label for="adv_from_date">From Date:</label>
								<input type="date" id="adv_from_date" name="adv_from_date" class="form-control" value="<?php echo isset($_GET['adv_from_date']) ? $_GET['adv_from_date'] : ''; ?>">
							</div>
							<div class="col-md-4">
								<label for="adv_to_date">To Date:</label>
								<input type="date" id="adv_to_date" name="adv_to_date" class="form-control" value="<?php echo isset($_GET['adv_to_date']) ? $_GET['adv_to_date'] : ''; ?>">
							</div>
							<div class="col-md-4 d-flex align-items-end">
								<button type="submit" class="btn btn-primary">Filter</button>
								<a href="?page=financial_management" class="btn btn-secondary ml-2">Reset</a>
							</div>
						</div>
					</form>
					<table class="table table-bordered table-striped">
						<thead>
							<tr>
								<th>Date Paid</th>
								<th>Staff</th>
								<th>Amount</th>
								<th>Reason</th>
								<th>Action</th>
							</tr>
						</thead>
						<tbody>
							<?php 
							$adv_where = '';
							$adv_params = [];
							if (isset($_GET['adv_from_date']) && !empty($_GET['adv_from_date'])) {
								$adv_where .= ' AND date_paid >= ?';
								$adv_params[] = $_GET['adv_from_date'];
							}
							if (isset($_GET['adv_to_date']) && !empty($_GET['adv_to_date'])) {
								$adv_where .= ' AND date_paid <= ?';
								$adv_params[] = $_GET['adv_to_date'];
							}
							$adv_sql = "SELECT ap.*, CONCAT(m.firstname,' ',m.lastname) as staff_name FROM `advance_payments` ap INNER JOIN `mechanic_list` m ON ap.mechanic_id = m.id WHERE 1 $adv_where ORDER BY date_paid DESC";
							$adv_qry = $conn->prepare($adv_sql);
							if (!empty($adv_params)) {
								$adv_types = str_repeat('s', count($adv_params));
								$adv_qry->bind_param($adv_types, ...$adv_params);
							}
							$adv_qry->execute();
							$adv_result = $adv_qry->get_result();
							$adv_total_amount = 0;
							while($adv_row = $adv_result->fetch_assoc()):
								$adv_total_amount += $adv_row['amount'];
							?>
							<tr>
								<td><?php echo date("Y-m-d",strtotime($adv_row['date_paid'])) ?></td>
								<td><?php echo $adv_row['staff_name'] ?></td>
								<td>₹ <?php echo number_format($adv_row['amount'],2) ?></td>
								<td><?php echo $adv_row['reason'] ?></td>
								<td align="center">
									 <button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">Action</button>
									  <div class="dropdown-menu" role="menu">
										<a class="dropdown-item edit_advance" href="javascript:void(0)" data-id="<?php echo $adv_row['id'] ?>"><span class="fa fa-edit text-primary"></span> Edit</a>
										<div class="dropdown-divider"></div>
										<a class="dropdown-item delete_advance" href="javascript:void(0)" data-id="<?php echo $adv_row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
									  </div>
								</td>
							</tr>
							<?php endwhile; ?>
						</tbody>
						<tfoot>
							<tr>
								<th colspan="2" class="text-right">Total Amount:</th>
								<th>₹ <?php echo number_format($adv_total_amount, 2); ?></th>
								<th colspan="2"></th>
							</tr>
						</tfoot>
					</table>
				</div>

				<!-- Mobile View for Advances -->
				<div class="d-block d-md-none">
					<form method="GET" class="mb-3">
						<input type="hidden" name="page" value="financial_management">
						<div class="form-group">
							<label for="mobile_adv_from_date">From Date:</label>
							<input type="date" id="mobile_adv_from_date" name="adv_from_date" class="form-control" value="<?php echo isset($_GET['adv_from_date']) ? $_GET['adv_from_date'] : ''; ?>">
						</div>
						<div class="form-group">
							<label for="mobile_adv_to_date">To Date:</label>
							<input type="date" id="mobile_adv_to_date" name="adv_to_date" class="form-control" value="<?php echo isset($_GET['adv_to_date']) ? $_GET['adv_to_date'] : ''; ?>">
						</div>
						<button type="submit" class="btn btn-primary btn-block">Filter by Date</button>
						<a href="?page=financial_management" class="btn btn-secondary btn-block">Reset</a>
					</form>
					<div class="form-group mb-3">
						<label for="mobile_search_adv">Search:</label>
						<input type="text" id="mobile_search_adv" class="form-control" placeholder="Search by staff, reason...">
					</div>
					<div class="card">
						<div class="card-body text-right">
							<strong>Total Amount:</strong> ₹ <?php echo number_format($adv_total_amount, 2); ?>
						</div>
					</div>
					<div id="advance_cards">
						<?php 
						$adv_result->data_seek(0);
						while($adv_row = $adv_result->fetch_assoc()):
						?>
						<div class="card mb-3 advance-card" data-staff="<?php echo strtolower($adv_row['staff_name']); ?>" data-reason="<?php echo strtolower($adv_row['reason']); ?>">
							<div class="card-header">
								<?php echo date("Y-m-d",strtotime($adv_row['date_paid'])) ?>
							</div>
							<div class="card-body">
								<p><strong>Staff:</strong> <?php echo $adv_row['staff_name'] ?></p>
								<p><strong>Amount:</strong> ₹ <?php echo number_format($adv_row['amount'],2) ?></p>
								<p><strong>Reason:</strong> <?php echo $adv_row['reason'] ?></p>
							</div>
							<div class="card-footer text-center">
								<button type="button" class="btn btn-flat btn-default btn-sm dropdown-toggle dropdown-icon" data-toggle="dropdown">Action</button>
								<div class="dropdown-menu" role="menu">
									<a class="dropdown-item edit_advance" href="javascript:void(0)" data-id="<?php echo $adv_row['id'] ?>"><span class="fa fa-edit text-primary"></span> Edit</a>
									<div class="dropdown-divider"></div>
									<a class="dropdown-item delete_advance" href="javascript:void(0)" data-id="<?php echo $adv_row['id'] ?>"><span class="fa fa-trash text-danger"></span> Delete</a>
								</div>
							</div>
						</div>
						<?php endwhile; ?>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<script>
	$(document).ready(function(){
		$('#add_expense').click(function(){
			uni_modal("<i class='fa fa-plus'></i> Add Expense","expenses/manage_expense.php")
		})
		$('.edit_expense').click(function(){
			uni_modal("<i class='fa fa-edit'></i> Edit Expense","expenses/manage_expense.php?id="+$(this).attr('data-id'))
		})
		$('.delete_expense').click(function(){
			_conf("Are you sure to delete this expense?","delete_expense",[$(this).attr('data-id')])
		})

		$('#add_advance').click(function(){
			uni_modal("<i class='fa fa-plus'></i> Add Advance","?page=financial_management&mode=advance_form")
		})
		$('.edit_advance').click(function(){
			uni_modal("<i class='fa fa-edit'></i> Edit Advance","?page=financial_management&mode=advance_form&id="+$(this).attr('data-id'))
		})
		$('.delete_advance').click(function(){
			_conf("Are you sure to delete this advance?","delete_advance",[$(this).attr('data-id')])
		})

		$('.table').dataTable();

		// Mobile search filter for expenses
		$('#mobile_search_exp').on('keyup', function(){
			var value = $(this).val().toLowerCase();
			$('#expense_cards .expense-card').filter(function(){
				$(this).toggle($(this).data('category').indexOf(value) > -1 || $(this).data('remarks').indexOf(value) > -1);
			});
		});

		// Mobile search filter for advances
		$('#mobile_search_adv').on('keyup', function(){
			var value = $(this).val().toLowerCase();
			$('#advance_cards .advance-card').filter(function(){
				$(this).toggle($(this).data('staff').indexOf(value) > -1 || $(this).data('reason').indexOf(value) > -1);
			});
		});
	})
	function delete_expense($id){
		start_loader();
		$.ajax({
			url:_base_url_+"classes/Master.php?f=delete_expense",
			method:"POST",
			data:{id: $id},
			dataType:"json",
			success:function(resp){
				if(resp.status == 'success') location.reload();
				else alert_toast("An error occured.",'error');
				end_loader();
			}
		})
	}
	function delete_advance($id){
		start_loader();
		$.ajax({
			url:_base_url_+"classes/Master.php?f=delete_advance",
			method:"POST",
			data:{id: $id},
			dataType:"json",
			success:function(resp){
				if(resp.status == 'success') location.reload();
				else alert_toast("An error occured.",'error');
				end_loader();
			}
		})
	}
</script>
</DOCUMENT>