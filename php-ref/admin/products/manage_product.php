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
    #cimg{ 
        width: 100%; 
        max-height: 150px; 
        object-fit: scale-down; 
        border-radius: 5px; 
        background: #eee; 
    }
    
    /* Mobile Optimization */
    @media (max-width: 768px) {
        .modal-dialog {
            margin: 10px !important;
        }
        
        .modal-content {
            border-radius: 10px !important;
        }
        
        .modal-body {
            padding: 15px !important;
            max-height: 70vh !important;
            overflow-y: auto !important;
        }
        
        .modal-footer {
            display: flex !important;
            flex-wrap: wrap !important;
            padding: 10px 15px !important;
            background: #f8f9fa !important;
            border-top: 1px solid #dee2e6 !important;
            position: sticky !important;
            bottom: 0 !important;
            z-index: 1000 !important;
        }
        
        .modal-footer .btn {
            flex: 1 !important;
            min-width: 120px !important;
            margin: 2px !important;
            font-size: 0.9rem !important;
            padding: 8px 12px !important;
        }
        
        .form-group {
            margin-bottom: 0.8rem !important;
        }
        
        .form-control {
            font-size: 0.9rem !important;
            padding: 0.4rem 0.75rem !important;
        }
        
        label.control-label {
            font-size: 0.85rem !important;
            margin-bottom: 0.25rem !important;
            font-weight: 600 !important;
        }
        
        #cimg {
            max-height: 120px !important;
        }
    }
    
    /* Landscape Mode */
    @media (max-width: 768px) and (orientation: landscape) {
        .modal-body {
            max-height: 60vh !important;
        }
        
        .modal-footer {
            position: relative !important;
        }
    }
    
    /* Very Small Screens */
    @media (max-width: 480px) {
        .modal-footer .btn {
            min-width: 110px !important;
            font-size: 0.85rem !important;
            padding: 7px 10px !important;
        }
        
        .form-control {
            padding: 0.35rem 0.65rem !important;
        }
    }
</style>
<div class="container-fluid">
    <form action="" id="product-form">
        <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
        <div class="form-group">
            <label for="name" class="control-label">Product Name</label>
            <input type="text" name="name" id="name" class="form-control rounded-0" value="<?php echo isset($name) ? $name : ''; ?>" required>
        </div>
        <div class="form-group">
            <label for="description" class="control-label">Description</label>
            <textarea rows="3" name="description" id="description" class="form-control rounded-0" style="resize: vertical;"><?php echo isset($description) ? $description : ''; ?></textarea>
        </div>
        <div class="form-group">
            <label for="price" class="control-label">Price (₹)</label>
            <input type="number" step="any" name="price" id="price" class="form-control rounded-0 text-right" value="<?php echo isset($price) ? $price : ''; ?>" required>
        </div>
        <div class="form-group">
            <label for="status" class="control-label">Status</label>
            <select name="status" id="status" class="form-control rounded-0" required>
                <option value="1" <?php echo isset($status) && $status == 1 ? 'selected' : '' ?>>Active</option>
                <option value="0" <?php echo isset($status) && $status == 0 ? 'selected' : '' ?>>Inactive</option>
            </select>
        </div>
        <div class="form-group">
            <label for="" class="control-label">Product Image</label>
            <div class="custom-file">
                <input type="file" class="custom-file-input rounded-0" id="customFile" name="img" onchange="displayImg(this,$(this))" accept="image/*">
                <label class="custom-file-label" for="customFile">Choose file</label>
            </div>
        </div>
        <div class="form-group d-flex justify-content-center">
            <img src="<?php echo validate_image(isset($image_path) ? $image_path : '') ?>" alt="" id="cimg" class="img-fluid border shadow-sm">
        </div>
        
        <!-- Mobile Optimized Form Actions -->
        <div class="d-block d-md-none mt-4 pt-3 border-top">
            <div class="row g-2">
                <div class="col-6">
                    <button type="button" class="btn btn-secondary btn-block rounded-0" onclick="closeModal()">
                        <i class="fa fa-times"></i> Cancel
                    </button>
                </div>
                <div class="col-6">
                    <button type="submit" class="btn btn-primary btn-block rounded-0">
                        <i class="fa fa-save"></i> Save
                    </button>
                </div>
            </div>
        </div>
    </form>
</div>

<script>
    function displayImg(input,_this) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function (e) {
                $('#cimg').attr('src', e.target.result);
                _this.siblings('.custom-file-label').html(input.files[0].name)
            }
            reader.readAsDataURL(input.files[0]);
        }
    }
    
    // Function to close modal
    function closeModal() {
        // Try to find and close the modal
        if(typeof uni_modal !== 'undefined') {
            uni_modal.close();
        } else if($('#uni_modal').hasClass('show')) {
            $('#uni_modal').modal('hide');
        } else if($('.modal.show').length > 0) {
            $('.modal.show').modal('hide');
        }
    }
    
    $(document).ready(function(){
        // Bootstrap file input label update
        $('#customFile').on('change', function() {
            var fileName = $(this).val().split('\\').pop();
            $(this).next('.custom-file-label').addClass("selected").html(fileName);
        });
        
        // Handle form submission
        $('#product-form').submit(function(e){
            e.preventDefault();
            var _this = $(this);
            $('.err-msg').remove();
            start_loader();
            
            // Disable submit button to prevent double submission
            var submitBtn = _this.find('button[type="submit"]');
            var originalText = submitBtn.html();
            submitBtn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');
            
            $.ajax({
                url:_base_url_+"classes/Master.php?f=save_product",
                data: new FormData($(this)[0]),
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                type: 'POST',
                dataType: 'json',
                error:function(err){
                    console.log(err);
                    alert_toast("An error occurred.",'error');
                    end_loader();
                    submitBtn.prop('disabled', false).html(originalText);
                },
                success:function(resp){
                    if(typeof resp =='object' && resp.status == 'success'){
                        // If in mobile view with custom buttons, show success and close
                        if($(window).width() <= 768) {
                            alert_toast("Product saved successfully!", 'success');
                            setTimeout(function(){
                                closeModal();
                                // Try to refresh the parent page if it's a list
                                if(typeof Table !== 'undefined') {
                                    Table.reload();
                                }
                                location.reload();
                            }, 2000);
                        } else {
                            location.reload();
                        }
                    }else if(resp.status == 'failed' && !!resp.msg){
                        var el = $('<div>').addClass("alert alert-danger err-msg").text(resp.msg);
                        _this.prepend(el);
                        el.show('slow');
                        end_loader();
                        submitBtn.prop('disabled', false).html(originalText);
                    }else{
                        alert_toast("An error occurred.",'error');
                        end_loader();
                        submitBtn.prop('disabled', false).html(originalText);
                    }
                }
            });
        });
        
        // Handle mobile keyboard showing/hiding
        if($(window).width() <= 768) {
            var originalHeight = $(window).height();
            
            $(window).on('resize', function() {
                var currentHeight = $(window).height();
                if(currentHeight < originalHeight) {
                    // Keyboard is showing
                    $('.modal-footer').hide();
                } else {
                    // Keyboard is hidden
                    $('.modal-footer').show();
                }
            });
            
            // Focus management for mobile
            $('input, textarea, select').on('focus', function() {
                // Scroll to input on focus
                setTimeout(function() {
                    $(this).get(0).scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }.bind(this), 300);
            });
        }
        
        // Add swipe to close on mobile
        if($(window).width() <= 768) {
            var startX, startY;
            var modalContent = $('.modal-content');
            
            modalContent.on('touchstart', function(e) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            });
            
            modalContent.on('touchmove', function(e) {
                if(!startX || !startY) return;
                
                var diffX = startX - e.touches[0].clientX;
                var diffY = startY - e.touches[0].clientY;
                
                // If vertical swipe is more than horizontal and downward
                if(Math.abs(diffY) > Math.abs(diffX) && diffY < -50) {
                    // Downward swipe - close modal
                    closeModal();
                }
            });
        }
    });
</script>

<!-- Add this if your modal doesn't have proper footer -->
<script>
$(document).ready(function() {
    // Check if modal footer exists, if not create one
    if($(window).width() <= 768 && $('.modal-footer').length === 0) {
        var modalContent = $('.modal-content');
        if(modalContent.length > 0) {
            var footerHtml = `
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">
                        <i class="fa fa-times"></i> Cancel
                    </button>
                    <button type="button" class="btn btn-primary" onclick="$('#product-form').submit()">
                        <i class="fa fa-save"></i> Save
                    </button>
                </div>
            `;
            modalContent.append(footerHtml);
        }
    }
    
    // Make sure modal is mobile friendly
    $('.modal').addClass('fade');
    $('.modal-dialog').addClass('modal-dialog-centered');
});
</script>