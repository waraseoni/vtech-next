<DOCUMENT filename="index.php">
<div class="card card-outline card-primary">
	<div class="card-header">
		<h3 class="card-title">Expense List</h3>
		<div class="card-tools">
			<button id="add_expense" class="btn btn-flat btn-sm btn-primary"><span class="fas fa-plus"></span> Add New Expense</button>
		</div>
	</div>
	<div class="card-body">
		<!-- Desktop View -->
		<div class="d-none d-md-block">
			<form method="GET" class="mb-3">
				<input type="hidden" name="page" value="expenses">
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
						<a href="?page=expenses" class="btn btn-secondary ml-2">Reset</a>
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

		<!-- Mobile View -->
		<div class="d-block d-md-none">
			<form method="GET" class="mb-3">
				<input type="hidden" name="page" value="expenses">
				<div class="form-group">
					<label for="mobile_from_date">From Date:</label>
					<input type="date" id="mobile_from_date" name="from_date" class="form-control" value="<?php echo isset($_GET['from_date']) ? $_GET['from_date'] : ''; ?>">
				</div>
				<div class="form-group">
					<label for="mobile_to_date">To Date:</label>
					<input type="date" id="mobile_to_date" name="to_date" class="form-control" value="<?php echo isset($_GET['to_date']) ? $_GET['to_date'] : ''; ?>">
				</div>
				<button type="submit" class="btn btn-primary btn-block">Filter by Date</button>
				<a href="?page=expenses" class="btn btn-secondary btn-block">Reset</a>
			</form>
			<div class="form-group mb-3">
				<label for="mobile_search">Search:</label>
				<input type="text" id="mobile_search" class="form-control" placeholder="Search by category, remarks...">
			</div>
			<div class="card">
				<div class="card-body text-right">
					<strong>Total Amount:</strong> ₹ <?php echo number_format($total_amount, 2); ?>
				</div>
			</div>
			<div id="expense_cards">
				<?php 
				// Reset result pointer or re-execute query if needed
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
			<div class="card">
				<div class="card-body text-right">
					<strong>Total Amount:</strong> ₹ <?php echo number_format($total_amount, 2); ?>
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
		$('.table').dataTable();

		// Mobile search filter
		$('#mobile_search').on('keyup', function(){
			var value = $(this).val().toLowerCase();
			$('#expense_cards .expense-card').filter(function(){
				$(this).toggle($(this).data('category').indexOf(value) > -1 || $(this).data('remarks').indexOf(value) > -1);
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
</script>
</DOCUMENT>