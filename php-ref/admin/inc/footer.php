<script>
  $(document).ready(function(){
     window.viewer_modal = function($src = ''){
      start_loader()
      var t = $src.split('.')
      t = t[1]
      if(t =='mp4'){
        var view = $("<video src='"+$src+"' controls autoplay></video>")
      }else{
        var view = $("<img src='"+$src+"' />")
      }
      $('#viewer_modal .modal-content video,#viewer_modal .modal-content img').remove()
      $('#viewer_modal .modal-content').append(view)
      $('#viewer_modal').modal({
              show:true,
              backdrop:'static',
              keyboard:false,
              focus:true
            })
            end_loader()  

  }
    window.uni_modal = function($title = '' , $url='',$size=""){
        start_loader()
        $.ajax({
            url:$url,
            error:err=>{
                console.log()
                alert("An error occured")
            },
            success:function(resp){
                if(resp){
                    $('#uni_modal .modal-title').html($title)
                    $('#uni_modal .modal-body').html(resp)
                    if($size != ''){
                        $('#uni_modal .modal-dialog').addClass($size+'  modal-dialog-centered')
                    }else{
                        $('#uni_modal .modal-dialog').removeAttr("class").addClass("modal-dialog modal-md modal-dialog-centered")
                    }
                    $('#uni_modal').modal({
                      show:true,
                      backdrop:'static',
                      keyboard:false,
                      focus:true
                    })
                    end_loader()
                }
            }
        })
    }
    window._conf = function($msg='',$func='',$params = []){
       $('#confirm_modal #confirm').attr('onclick',$func+"("+$params.join(',')+")")
       $('#confirm_modal .modal-body').html($msg)
       $('#confirm_modal').modal('show')
    }
  })
</script>

<div class="mobile-bottom-nav d-md-none">
    <a href="./" class="nav-item">
        <i class="fas fa-tachometer-alt"></i>
        <span>Home</span>
    </a>
    <a href="./?page=attendance" class="nav-item">
        <i class="fas fa-calendar-check"></i>
        <span>Attendance</span>
    </a>
    <a href="./?page=clients" class="nav-item">
        <i class="fas fa-user-friends"></i>
        <span>Clients</span>
    </a>
	<a href="./?page=direct_sales" class="nav-item">
        <i class="fas fa-clipboard-check"></i>
        <span>Sales</span>
    </a>
    <a href="./?page=inventory" class="nav-item">
        <i class="fas fa-clipboard-check"></i>
        <span>Stock</span>
    </a>
    <a href="./?page=transactions" class="nav-item">
        <i class="fas fa-clipboard-list"></i>
        <span>Jobs</span>
    </a>
	<?php if($_settings->userdata('type') == 1): ?>
		<a href="./?page=products" class="nav-item">
            <i class="fas fa-clipboard text-green"></i>
            <span>Product</span>
        </a>
        <a href="./?page=expenses/finance_report" class="nav-item">
            <i class="fas fa-money-bill-wave text-green"></i>
            <span>Pay Outs</span>
        </a>        
        <a href="./?page=salery/salary_management" class="nav-item">
            <i class="fas fa-hand-holding-usd text-primary"></i>
            <span>Salery</span>
        </a>
        <a href="./?page=lenders" class="nav-item">
            <i class="fas fa-wallet text-danger"></i>
            <span>Loan</span>
        </a>
        <a href="./?page=user/list" class="nav-item">
            <i class="fas fa-users-cog text-secondary"></i>
            <span>Users</span>
        </a>
    <?php endif; ?>

    <a href="<?php echo base_url.'admin/?page=user' ?>" class="nav-item">
        <i class="fas fa-user-circle"></i>
        <span>Profile</span>
    </a>
</div>
<style>
/* Scrollable Bottom Nav Styling */
.mobile-bottom-nav {
    position: fixed !important;
    bottom: 0 !important;
    left: 0;
    right: 0;
    width: 100%;
    height: 70px;
    background-color: #343a40; 
    display: flex;
    overflow-x: auto; /* Zyada icons hone par scroll chalega */
    overflow-y: hidden;
    white-space: nowrap;
    z-index: 99999 !important; 
    border-top: 3px solid #007bff;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.5);
    -webkit-overflow-scrolling: touch; /* Smooth scrolling for mobile */
}

/* Hide Scrollbar for cleaner look */
.mobile-bottom-nav::-webkit-scrollbar {
    display: none;
}

.mobile-bottom-nav .nav-item {
    color: #c2c7d0;
    text-align: center;
    padding: 10px 15px; /* Spacing for horizontal scroll */
    min-width: 75px;    /* Icon box ki width */
    text-decoration: none;
    font-size: 11px;
    flex-shrink: 0;     /* Icons ko sikadne se rokne ke liye */
}

.mobile-bottom-nav .nav-item i {
    display: block;
    font-size: 20px;
    margin-bottom: 3px;
}

.mobile-bottom-nav .nav-item span {
    display: block;
}

/* Active State */
.mobile-bottom-nav .nav-item:active,
.mobile-bottom-nav .nav-item:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
}
</style>
<style>
@media (max-width: 767.98px) {
    .mobile-bottom-nav {
        position: fixed !important; /* !important lagane se ye screen par chipka rahega */
        bottom: 0 !important;
        left: 0;
        right: 0;
        width: 100%;
        height: 65px;
        background-color: #343a40; 
        display: flex;
        justify-content: space-around;
        align-items: center;
        /* Ise sabse upar rakhne ke liye z-index badha dein */
        z-index: 99999 !important; 
        border-top: 3px solid #007bff;
        padding-bottom: env(safe-area-inset-bottom); /* iPhone notch compatibility ke liye */
    }

    /* Content ko bottom nav ke piche chhupne se bachane ke liye */
    body {
        padding-bottom: 70px !important;
    }
    
    .main-footer {
        display: none !important; /* Mobile par purana footer hide kar dein */
    }
}
/* Bottom Nav Styling */
.mobile-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background-color: #343a40; /* Dark Theme */
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: 9999;
    border-top: 2px solid #007bff;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.2);
}

.mobile-bottom-nav .nav-item {
    color: #c2c7d0;
    text-align: center;
    flex: 1;
    text-decoration: none;
    font-size: 10px;
}

.mobile-bottom-nav .nav-item i {
    display: block;
    font-size: 18px;
    margin-bottom: 2px;
}

.mobile-bottom-nav .nav-item:hover, 
.mobile-bottom-nav .nav-item.active {
    color: #007bff;
}
</style>

<footer class="main-footer text-sm">
        <strong>Copyright © <?php echo date('Y') ?>. 
        <!-- <a href=""></a> -->
        </strong>
        All rights reserved.
        <div class="float-right d-none d-sm-inline-block">
          <b><?php echo $_settings->info('short_name') ?> (by: <a href="mailto:vtech.jbp@gmail.com" target="blank">vtech.jbp</a> )</b> v1.0
        </div>
      </footer>
    </div>
    <!-- ./wrapper -->
   
    <!-- Resolve conflict in jQuery UI tooltip with Bootstrap tooltip -->
    <script>
      $.widget.bridge('uibutton', $.ui.button)
    </script>
    <!-- Bootstrap 4 -->
    <script src="<?php echo base_url ?>plugins/bootstrap/js/bootstrap.bundle.min.js"></script>
    <!-- ChartJS -->
    <script src="<?php echo base_url ?>plugins/chart.js/Chart.min.js"></script>
    <!-- Sparkline -->
    <script src="<?php echo base_url ?>plugins/sparklines/sparkline.js"></script>
    <!-- Select2 -->
    <script src="<?php echo base_url ?>plugins/select2/js/select2.full.min.js"></script>
    <!-- JQVMap -->
    <script src="<?php echo base_url ?>plugins/jqvmap/jquery.vmap.min.js"></script>
    <script src="<?php echo base_url ?>plugins/jqvmap/maps/jquery.vmap.usa.js"></script>
    <!-- jQuery Knob Chart -->
    <script src="<?php echo base_url ?>plugins/jquery-knob/jquery.knob.min.js"></script>
    <!-- daterangepicker -->
    <script src="<?php echo base_url ?>plugins/moment/moment.min.js"></script>
    <script src="<?php echo base_url ?>plugins/daterangepicker/daterangepicker.js"></script>
    <!-- Tempusdominus Bootstrap 4 -->
    <script src="<?php echo base_url ?>plugins/tempusdominus-bootstrap-4/js/tempusdominus-bootstrap-4.min.js"></script>
    <!-- Summernote -->
    <script src="<?php echo base_url ?>plugins/summernote/summernote-bs4.min.js"></script>
    <script src="<?php echo base_url ?>plugins/datatables/jquery.dataTables.min.js"></script>
    <script src="<?php echo base_url ?>plugins/datatables-bs4/js/dataTables.bootstrap4.min.js"></script>
    <script src="<?php echo base_url ?>plugins/datatables-responsive/js/dataTables.responsive.min.js"></script>
    <script src="<?php echo base_url ?>plugins/datatables-responsive/js/responsive.bootstrap4.min.js"></script>
    <!-- overlayScrollbars -->
     <script src="<?php echo base_url ?>plugins/overlayScrollbars/js/jquery.overlayScrollbars.min.js"></script>
    <!-- AdminLTE App -->
    <script src="<?php echo base_url ?>dist/js/adminlte.js"></script>
    <div class="daterangepicker ltr show-ranges opensright">
      <div class="ranges">
        <ul>
          <li data-range-key="Today">Today</li>
          <li data-range-key="Yesterday">Yesterday</li>
          <li data-range-key="Last 7 Days">Last 7 Days</li>
          <li data-range-key="Last 30 Days">Last 30 Days</li>
          <li data-range-key="This Month">This Month</li>
          <li data-range-key="Last Month">Last Month</li>
          <li data-range-key="Custom Range">Custom Range</li>
        </ul>
      </div>
      <div class="drp-calendar left">
        <div class="calendar-table"></div>
        <div class="calendar-time" style="display: none;"></div>
      </div>
      <div class="drp-calendar right">
        <div class="calendar-table"></div>
        <div class="calendar-time" style="display: none;"></div>
      </div>
      <div class="drp-buttons"><span class="drp-selected"></span><button class="cancelBtn btn btn-sm btn-default" type="button">Cancel</button><button class="applyBtn btn btn-sm btn-primary" disabled="disabled" type="button">Apply</button> </div>
    </div>
    <div class="jqvmap-label" style="display: none; left: 1093.83px; top: 394.361px;">Idaho</div>