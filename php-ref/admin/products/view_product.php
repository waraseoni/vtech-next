<?php
require_once('../../config.php');
if(isset($_GET['id']) && $_GET['id'] > 0){
    $stmt = $conn->prepare("SELECT * from `product_list` where id = ?");
    $stmt->bind_param("i", $_GET['id']);
    $stmt->execute();
    $qry = $stmt->get_result();
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){ $$k=$v; }
    }
    $stmt->close();
}
?>
<style>
    #uni_modal .modal-footer{ display:none; }
    .view-cimg{ width:100%; max-height:250px; object-fit:scale-down; background: #f8f9fa; border-radius: 10px; }
    .label-desc{ color: #666; font-size: 0.9rem; margin-bottom: 2px; }
</style>
<div class="container-fluid">
    <div class="text-center mb-3">
		<img src="<?= validate_image(isset($image_path) ? $image_path : '') ?>" alt="" class="view-cimg border shadow-sm">
    </div>
	<div class="row">
        <div class="col-md-12">
            <div class="form-group border-bottom pb-2">
                <label class="label-desc">Product Name</label>
                <div class="font-weight-bold h5 text-navy"><?= isset($name) ? $name : "" ?></div>
            </div>
            <div class="form-group border-bottom pb-2">
                <label class="label-desc">Description</label>
                <div class="pl-2"><?= isset($description) ? nl2br($description) : 'No description provided.' ?></div>
            </div>
            <div class="row">
                <div class="col-6">
                    <div class="form-group">
                        <label class="label-desc">Price</label>
                        <div class="h5 text-primary">₹ <?= isset($price) ? number_format($price, 2) : '0.00' ?></div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="form-group">
                        <label class="label-desc">Status</label>
                        <div>
                            <?php if($status == 1): ?>
                                <span class="badge badge-success px-3">Active</span>
                            <?php else: ?>
                                <span class="badge badge-danger px-3">Inactive</span>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="text-right mt-3">
        <button class="btn btn-dark btn-flat btn-sm" type="button" data-dismiss="modal">Close</button>
    </div>
</div>