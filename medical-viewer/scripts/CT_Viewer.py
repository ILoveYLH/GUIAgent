import os
import tempfile
import streamlit as st
import plotly.graph_objects as go

from visualization.ct_loader import load_ct_volume, apply_window

# ------------- 全局配置 -------------
# 预定义窗位/窗宽组合
WINDOW_PRESETS = {
    "肺窗": (-600, 1500),
    "纵隔窗": (40, 400),
    "骨窗": (400, 1800),
    "软组织窗": (50, 350),
}

# ------------- 核心渲染组件 -------------
def render_pure_ct_viewer(ct_volume, key_prefix="pure_viewer"):
    """
    简化的独立的 CT 影像查看组件。
    职责：滑块切换切片、下拉菜单调整窗宽窗位、利用 Plotly Heatmap 渲染影像。
    """
    st.markdown("### 🖼️ 独立 CT 影像查看组件")

    # 1. 控件区 
    ctrl_col1, ctrl_col2, _ = st.columns([3, 2, 2])

    with ctrl_col1:
        slice_key = f"{key_prefix}_slice"
        if slice_key not in st.session_state:
            st.session_state[slice_key] = ct_volume.num_slices // 2

        current_slice = st.slider(
            "切片位置 (Z轴)",
            min_value=0,
            max_value=ct_volume.num_slices - 1,
            key=slice_key,
            help=f"总计 {ct_volume.num_slices} 张切片",
        )

    with ctrl_col2:
        window_name = st.selectbox(
            "窗位/窗宽",
            options=list(WINDOW_PRESETS.keys()),
            index=0,
            key=f"{key_prefix}_window",
        )
        wc, ww = WINDOW_PRESETS[window_name]

    # 2. 图像数据准备
    slice_hu = ct_volume.array[current_slice]
    slice_display = apply_window(slice_hu, wc, ww)

    # 3. Plotly 绘图
    fig = go.Figure()
    fig.add_trace(go.Heatmap(
        z=slice_display,
        colorscale="gray",
        showscale=False,
        hovertemplate=(
            "X: %{x}<br>"
            "Y: %{y}<br>"
            "HU: %{customdata:.0f}<br>"
            "<extra></extra>"
        ),
        customdata=slice_hu,
    ))

    # 更新坐标轴布局
    fig.update_layout(
        xaxis=dict(
            scaleanchor="y",
            scaleratio=1,
            showgrid=False,
            zeroline=False,
            showticklabels=False,
        ),
        yaxis=dict(
            showgrid=False,
            zeroline=False,
            showticklabels=False,
            autorange="reversed", # 医学图像 Y 轴翻转
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=600,
        plot_bgcolor="black",
        paper_bgcolor="black",
    )

    st.plotly_chart(
        fig,
        use_container_width=True,
        key=f"{key_prefix}_plot",
        config={"scrollZoom": False}, 
    )

    st.caption(
        f"📐 切片记录: **{current_slice}**/{ct_volume.num_slices - 1} | "
        f"原始尺寸: **{ct_volume.width}×{ct_volume.height}** | "
        f"体素间距: **{ct_volume.spacing[0]:.3f}×{ct_volume.spacing[1]:.3f}×{ct_volume.spacing[2]:.3f} mm**"
    )

def main():
    st.set_page_config(page_title="CT Viewer 独立测试", page_icon="🖼️", layout="wide")
    
    st.title("CT Viewer 单独影像测试页面")
    st.markdown(
        "直接上传 DICOM (.zip) 或 NIfTI 或 .mhd/.raw "
    )

    uploaded_files = st.file_uploader(
        "上传您的实验医学影像文件", 
        type=["zip", "nii.gz", "nii", "mhd", "raw"],
        accept_multiple_files=True,
        help="支持的格式包括：打包为 ZIP 的 DICOM 序列, .nii.gz, .nii, 或者同时上传 .mhd 和配套的 .raw"
    )

    if uploaded_files:
        # 基于所有文件的组合 ID 生成唯一 key，防止重复解析
        file_key = "_".join([f.file_id for f in uploaded_files])
        
        if st.session_state.get("test_ct_volume_id") != file_key:
            st.session_state["test_ct_volume"] = None
            st.session_state["test_ct_volume_id"] = file_key
            
            with tempfile.TemporaryDirectory() as tmp_dir:
                main_file_path = None
                
                # 首先保存所有上传的文件到临时目录
                for f_obj in uploaded_files:
                    temp_file_path = os.path.join(tmp_dir, f_obj.name)
                    with open(temp_file_path, "wb") as f_out:
                        f_out.write(f_obj.getbuffer())
                    
                    # 判断哪个是主文件
                    lower_name = f_obj.name.lower()
                    if lower_name.endswith((".zip", ".nii.gz", ".nii", ".mhd")):
                        main_file_path = temp_file_path
                        
                if main_file_path is None:
                    st.error("❌ 在上传的文件中未找到支持的主图像文件 (需包含 .zip, .nii.gz, .nii, 或 .mhd)。请重新上传。")
                else:
                    try:
                        with st.spinner(f"⏳ 正在后台解析 3D 体数据，过程可能持续数秒..."):
                            ct_volume = load_ct_volume(main_file_path)
                            st.session_state["test_ct_volume"] = ct_volume
                        st.toast("✅ 数据加载成功！", icon='🎉')
                    except Exception as e:
                        st.error(f"❌ 文件解析失败，可能并非受支持的医疗影像格式，或者缺失配套数据（如 .raw）。\n错误信息: {str(e)}")
                        st.exception(e)
                    
        # 当解析的数据挂载在 session state 后，渲染组件
        if st.session_state.get("test_ct_volume") is not None:
            st.markdown("---")
            render_pure_ct_viewer(st.session_state["test_ct_volume"])

if __name__ == "__main__":
    main()
