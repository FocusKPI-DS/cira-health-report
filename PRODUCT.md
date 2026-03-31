# Cira Health - 产品流程文档

## 项目概述

Cira Health 是一个基于 AI 的医疗器械风险分析平台，能够在 30 秒内生成初步危害分析 (PHA, Preliminary Hazard Analysis) 报告。该系统整合了 FDA 的多个数据库，包括 MAUDE、510(k)、设备分类等，为医疗器械制造商提供快速、准确、符合 FDA 合规要求的风险分析报告。

### 技术架构

- **前端**: Next.js 14 + React 18 + TypeScript (Cira-C 项目)
- **后端**: FastAPI + Python (Cira-Health-Internal/backend)
- **消息队列**: Apache Kafka
- **数据库**: PostgreSQL
- **认证**: Firebase Authentication
- **AI 引擎**: OpenAI API
- **支付**: Stripe

---

## 完整业务流程

### 阶段 1: 用户输入与产品搜索

#### 1.1 首页输入 (`/app/page.tsx`)

**用户操作**:
1. 访问 Cira Health 首页
2. 在搜索框输入设备名称（如 "Insulin Pump"）或 FDA 产品代码（如 "KZH"）
3. 点击 "Try It for Free" 按钮

**前端处理**:
```typescript
// app/page.tsx
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  if (productName.trim()) {
    trackEvent('try_it_for_free', { product_name: productName.trim() })
    router.push(`/generate?productName=${encodeURIComponent(productName)}`)
  }
}
```

**数据流向**:
- 输入 → URL 参数 → Generate 页面

#### 1.2 生成工作流初始化 (`/app/generate/page.tsx`)

**页面加载**:
1. 从 URL 参数读取 `productName`
2. 初始化 `useGenerateWorkflow` hook
3. 显示 AI 助手欢迎消息

**前端组件**:
```typescript
// app/generate/page.tsx
const initialProductName = searchParams.get('productName') || ''
const workflow = useGenerateWorkflow({ initialProductName })
```

---

### 阶段 2: 智能对话与数据收集

#### 2.1 对话流程 (`/lib/useGenerateWorkflow.ts`)

**工作流状态管理**:
```typescript
interface CollectedParams {
  deviceName: string | null          // 设备名称
  productCodes: string[]              // FDA 产品代码列表
  intendedUse: string | null          // 预期用途
  selectedProducts: SimilarProduct[]  // 用户选择的相似产品
  dbSearchType?: string               // 数据库搜索类型
  dbSearchValues?: string[]           // 搜索值
  dbSearchKeyword?: string            // 关键词
}
```

**对话阶段**:

1. **设备名称确认**
   - AI: "I'm ready to help you generate a PHA Analysis for **[Product Name]**. Press Send to search..."
   - 用户: 确认或修改设备名称

2. **产品搜索与匹配**
   - 前端调用 `/api/v1/anonclient/search-fda-products`
   - 返回 FDA 数据库中的相似产品
   - 用户选择匹配的产品

3. **预期用途收集**
   - AI: "What is the intended use of your device?"
   - 用户: 描述预期用途或选择自动填充

4. **ISO 24971 危害类别选择**
   - AI 展示 ISO 24971 标准的危害类别清单
   - 用户选择相关的危害类别

5. **分析模式选择**
   - **Simple Mode**: 快速生成，适用于初步评估
   - **Detailed Mode**: 深度分析，基于选定的危害类别

#### 2.2 后端搜索 API (`/backend/app/routers/anonclient.py`)

**搜索端点**: `GET /api/v1/anonclient/search-fda-products`

**搜索逻辑**:
1. 接收关键词或产品代码
2. 查询 FDA 数据库（产品分类、510(k) 等）
3. 返回匹配的产品列表，包含：
   - 产品代码 (product_code)
   - 设备名称 (device_name)
   - 设备分类 (device_class)
   - 监管描述 (regulation_description)
   - 相似度评分

---

### 阶段 3: 分析启动

#### 3.1 前端发起分析 (`/lib/useGenerateWorkflow.ts`)

**启动条件检查**:
```typescript
const isReadyToStart = 
  collected.deviceName !== null &&
  collected.productCodes.length > 0 &&
  collected.intendedUse !== null &&
  collected.selectedProducts.length > 0
```

**API 调用**:
```typescript
const result = await analysisApi.startAnalysisAndPoll(
  data.productCodes,
  similarProductsForBackend,
  data.deviceName,
  data.intendedUse,
  statusCallback,
  5000, // 轮询间隔
  data.dbSearchType,
  data.dbSearchValues,
  data.dbSearchKeyword,
  hazards,
  mode,
  availableHazards,
  searchStartDate,
  searchEndDate
)
```

#### 3.2 后端分析入口 (`/backend/app/routers/anonclient.py`)

**API 端点**: `POST /api/v1/anonclient/start-analysis`

**请求体**:
```json
{
  "product_codes": ["KZH", "LZG"],
  "similar_products": [...],
  "product_name": "Insulin Pump",
  "intended_use_snapshot": "用于糖尿病患者的胰岛素输注",
  "db_search_type": "keywords",
  "db_search_values": ["insulin", "pump"],
  "db_search_keyword": "insulin pump malfunction",
  "hazard_categories": ["Energy", "Biological", "Information"],
  "analysis_mode": "detailed",
  "available_hazards": ["Electric Shock", "Infection", "Data Loss"]
}
```

**后端处理流程**:

1. **用户认证**
   ```python
   uid = Depends(get_current_user)  # Firebase UID
   ```

2. **匿名用户初始化**
   ```python
   anon_user = await apphub_service.initAnonymousUser(uid)
   team_id = anon_user.get("team_id")
   ```

3. **创建产品配置**
   ```python
   # 插入 products 表
   product_id = await conn.fetchval(
       """INSERT INTO public2.products 
          (product_id, user_id, team_id, name, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING product_id""",
       generate_id('product'),
       uid,
       team_id,
       product_name,
       datetime.now(),
       datetime.now()
   )
   
   # 插入 product_configurations 表
   config_id = await conn.fetchval(
       """INSERT INTO public2.product_configurations 
          (config_id, product_id, config_number, config_description, 
           intended_use, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING config_id""",
       generate_id('config'),
       product_id,
       'v1',
       'Initial configuration',
       intended_use_snapshot,
       datetime.now(),
       datetime.now()
   )
   ```

4. **保存相似产品**
   ```python
   for product in similar_products:
       similar_product_id = await conn.fetchval(
           """INSERT INTO public2.similar_products 
              (similar_product_id, product_code, device, ...)
              VALUES ($1, $2, $3, ...) RETURNING similar_product_id""",
           ...
       )
       
       # 关联到产品
       await conn.execute(
           """INSERT INTO public2.product_similar_products 
              (product_id, similar_product_id, similarity_score)
              VALUES ($1, $2, $3)""",
           product_id, similar_product_id, similarity
       )
   ```

5. **创建 PHA 分析版本**
   ```python
   analysis_id = generate_id('pha_analysis')
   await conn.execute(
       """INSERT INTO public2.pha_analysis_versions 
          (analysis_id, config_id, version_number, status, 
           created_by, last_modified_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
       analysis_id,
       config_id,
       'v1',
       'Generating',  # 初始状态
       uid,
       uid,
       datetime.now(),
       datetime.now()
   )
   ```

6. **保存过滤器设置**
   ```python
   await conn.execute(
       """INSERT INTO public2.pha_filters 
          (filter_id, analysis_id, analysis_mode, available_hazards, 
           hazard_categories, ...)
          VALUES ($1, $2, $3, $4, $5, ...)""",
       generate_id('filter'),
       analysis_id,
       analysis_mode,
       json.dumps(available_hazards),
       json.dumps(hazard_categories)
   )
   ```

7. **创建任务并发送到 Kafka**
   ```python
   task_id = generate_id('task')
   task_service = get_task_service()
   
   # 准备任务输入数据
   input_data = {
       'product_codes': product_codes,
       'product_id': product_id,
       'db_search_type': db_search_type,
       'db_search_values': db_search_values,
       'db_search_keyword': db_search_keyword,
       'filters': {
           'hazard_categories': hazard_categories,
           'analysis_mode': analysis_mode,
           'available_hazards': available_hazards,
           'dateRange': {
               'enabled': True,
               'startDate': '2010-01-01',
               'endDate': '2025-12-31'
           }
       }
   }
   
   # 创建任务记录
   await task_service.create_task(
       task_id=task_id,
       task_name='analyze_maude',
       status='pending',
       input_data=input_data,
       analysis_id=analysis_id,
       user_id=uid
   )
   
   # 发送到 Kafka
   kafka_producer = get_kafka_producer_service()
   await kafka_producer.send_task(
       task_id=task_id,
       task_name='analyze_maude',
       input_data=input_data,
       analysis_id=analysis_id,
       user_id=uid,
       required_environment=settings.environment
   )
   ```

8. **返回响应**
   ```json
   {
     "analysis_id": "pha_analysis_20260331_abc123",
     "status": "started",
     "message": "Analysis task created successfully"
   }
   ```

---

### 阶段 4: Kafka 消息队列处理

#### 4.1 Kafka 生产者 (`/backend/app/kafka/producer.py`)

**主题路由逻辑**:
```python
def _get_topic_for_task(self, task_name: str) -> Optional[str]:
    # analyze_maude 任务 → MAUDE 分析主题
    if task_name == 'analyze_maude':
        return settings.kafka_topic_analyze_maude  # 'analyze-maude-dev'
    
    # save_pha_* 任务 → PHA 级联保存主题
    if task_name.startswith('save_pha_'):
        return settings.kafka_topic_save_pha_with_cascading
    
    # download_full_report 任务 → 下载报告主题
    if task_name == 'download_full_report':
        return settings.kafka_topic_download_full_report
    
    return None
```

**消息格式**:
```json
{
  "task_id": "task_20260331_xyz789",
  "task_name": "analyze_maude",
  "input_data": {
    "product_codes": ["KZH"],
    "db_search_type": "keywords",
    "filters": {...}
  },
  "analysis_id": "pha_analysis_20260331_abc123",
  "user_id": "firebase_uid_12345",
  "required_environment": "development"
}
```

**分区策略**:
- 使用 `user_id` 作为分区键
- 保证同一用户的任务顺序执行
- 实现负载均衡

#### 4.2 Kafka 消费者 (`/backend/app/workers/kafka_worker.py`)

**Worker 启动**:
```bash
python -m app.workers.kafka_worker
```

**启动日志**:
```
================================================================================
🚀 KAFKA WORKER STARTING 🚀
Worker ID: kafka_worker_12345_678901234
Environment: development
Max Concurrent Tasks: 10
Topics: analyze-maude-dev, save-pha-with-cascading-dev, download-full-report-dev
================================================================================
```

**消费者配置**:
```python
consumer = await kafka_manager.create_consumer(
    topic='analyze-maude-dev',
    group_id='cira_workers_development',
    auto_offset_reset='earliest'  # 从最早的未消费消息开始
)
```

**并发控制**:
```python
MAX_CONCURRENT_TASKS = 10  # 最多同时执行 10 个任务
semaphore = asyncio.Semaphore(MAX_CONCURRENT_TASKS)

async def execute_and_cleanup(msg):
    async with semaphore:  # 获取信号量
        await execute_task(task_id)
        await consumer.commit()  # 提交偏移量
```

**消息处理流程**:

1. **接收消息**
   ```python
   async for message in consumer:
       message_data = json.loads(message.value)
       task_id = message_data.get('task_id')
       task_name = message_data.get('task_name')
       user_id = message_data.get('user_id')
       analysis_id = message_data.get('analysis_id')
   ```

2. **环境过滤**
   ```python
   task_required_env = message_data.get('required_environment')
   if task_required_env != settings.environment:
       logger.info(f"Skipping task - environment mismatch")
       await consumer.commit()
       continue
   ```

3. **去重检查**
   ```python
   if task_id in running_tasks:
       logger.warning(f"Task already running - task_id={task_id}")
       await consumer.commit()
       continue
   ```

4. **创建执行任务**
   ```python
   task = asyncio.create_task(execute_and_cleanup(message))
   running_tasks[task_id] = task
   ```

5. **自动重连机制**
   - 消费者故障自动重试
   - 指数退避策略（5秒 → 10秒 → 20秒 → ... → 最多 5分钟）
   - 无限重试直到成功或手动停止

---

### 阶段 5: MAUDE 数据分析

#### 5.1 任务执行器 (`/backend/app/tasks/executor.py`)

**任务注册表**:
```python
from app.tasks import maude_analysis_task  # 自动注册 @register_task('analyze_maude')
from app.tasks import pha_cascading_task    # 自动注册 @register_task('save_pha_with_cascading')
from app.tasks import download_center_task  # 自动注册 @register_task('download_full_report')
```

**任务执行**:
```python
async def execute_task(task_id: str):
    task_info = await task_service.get_task(task_id)
    
    # 更新状态为 running
    await task_service.update_task_status(task_id, 'running')
    
    # 获取注册的任务函数
    task_func = TASK_REGISTRY.get(task_info.task_name)
    
    # 执行任务
    result = await task_func(
        input_data=task_info.input_data,
        analysis_id=task_info.analysis_id,
        user_id=task_info.user_id,
        task_id=task_id
    )
    
    # 更新状态为 completed
    await task_service.update_task_status(task_id, 'completed', result)
```

#### 5.2 MAUDE 分析任务 (`/backend/app/tasks/maude_analysis_task.py`)

**任务入口**: `@register_task('analyze_maude')`

**主要步骤**:

**步骤 1: 初始化分析状态**
```python
# 更新分析状态为 'Generating'
await conn.execute(
    """UPDATE public2.pha_analysis_versions
       SET status = 'Generating',
           ai_total_records = 0,
           ai_current_count = 0,
           updated_at = $1
       WHERE analysis_id = $2""",
    datetime.now(), analysis_id
)

# 删除旧的分析详情
await conn.execute(
    "DELETE FROM public2.pha_analysis_details WHERE analysis_id = $1",
    analysis_id
)
```

**步骤 2: 验证输入并提取产品代码**
```python
input_data_obj = DeviceInput(**input_data)
product_codes = input_data_obj.product_codes

# 如果提供了 product_id，从 similar_products 表获取产品代码
if input_data_obj.product_id:
    query = """
        SELECT sp.product_code
        FROM public2.product_similar_products psp
        JOIN public2.similar_products sp ON psp.similar_product_id = sp.similar_product_id
        WHERE psp.product_id = $1
    """
    rows = await conn.fetch(query, input_data_obj.product_id)
    product_codes = [row['product_code'] for row in rows]
```

**步骤 3: 提取过滤器设置**
```python
filters = input_data_obj.filters

# URRA 描述
urra_descriptions = []
if filters and filters.urra_descriptions:
    for desc in filters.urra_descriptions:
        urra_descriptions.append({
            'user_description': desc.user_description,
            'version_number': desc.version_number,
            'version_description': desc.version_description
        })

# FMEA 描述
fmea_descriptions = []
if filters and filters.fmea_descriptions:
    for desc in filters.fmea_descriptions:
        fmea_descriptions.append({
            'step_description': desc.step_description,
            'version_number': desc.version_number
        })

# 日期范围
date_range_enabled = filters.date_range.enabled if filters else False
start_date = filters.date_range.start_date if filters else None
end_date = filters.date_range.end_date if filters else None

# 危害类别和分析模式
hazard_categories = filters.hazard_categories if filters else []
analysis_mode = filters.analysis_mode if filters else 'simple'
available_hazards = filters.available_hazards if filters else []
```

**步骤 4: 构建搜索查询**
```python
from app.services.maude_details import fetch_all_by_product_code_async

if input_data_obj.db_search_type == 'keywords':
    # 关键词搜索
    search_query = input_data_obj.db_search_keyword
    
elif input_data_obj.db_search_type == 'advanced':
    # 高级搜索（字段+值）
    field_value_pairs = list(zip(
        input_data_obj.db_search_fields,
        input_data_obj.db_search_values
    ))
    
else:
    # 默认：按产品代码搜索
    search_query = ' OR '.join([f'product_code:{code}' for code in product_codes])
```

**步骤 5: 批量获取 MAUDE 记录**
```python
maude_records = []
for product_code in product_codes:
    records = await fetch_all_by_product_code_async(
        product_code=product_code,
        search_query=search_query,
        start_date=start_date,
        end_date=end_date,
        limit=1000  # 最多获取 1000 条
    )
    maude_records.extend(records)

print(f"✓ Fetched {len(maude_records)} MAUDE records")
```

**步骤 6: LLM 批量提取危害信息**
```python
from app.services.maude_llm import extract_with_llm_batch_async

# 准备提示词
system_prompt = """
You are a medical device safety expert analyzing FDA MAUDE reports.
Extract the following information from each report:
- Hazard: The identified hazard or failure mode
- Potential Harm: The potential harm to patients or users
- Severity: Critical, Major, Minor, or Negligible
- Hazardous Situation: The scenario leading to harm
"""

# 批量处理（每批 50 条）
batch_size = 50
extracted_hazards = []

for i in range(0, len(maude_records), batch_size):
    batch = maude_records[i:i+batch_size]
    
    # 调用 OpenAI API
    batch_results = await extract_with_llm_batch_async(
        records=batch,
        system_prompt=system_prompt,
        model='gpt-4-turbo',
        temperature=0.3
    )
    
    extracted_hazards.extend(batch_results)
    
    # 更新进度
    await task_service.update_task_progress(
        task_id=task_id,
        current=i + len(batch),
        total=len(maude_records),
        message=f"Analyzing records {i + len(batch)}/{len(maude_records)}"
    )
```

**LLM 提取结果示例**:
```json
{
  "hazard": "Insulin over-delivery",
  "potential_harm": "Hypoglycemia leading to loss of consciousness",
  "severity": "Critical",
  "hazardous_situation": "Software error causing pump to deliver 10x intended dose",
  "source_url": "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfmaude/detail.cfm?mdrfoi__id=12345678",
  "product_code": "KZH",
  "device_name": "Insulin Infusion Pump",
  "date_received": "2024-03-15"
}
```

**步骤 7: 应用过滤器和排序**
```python
# 按严重性排序
severity_order = {'Critical': 0, 'Major': 1, 'Minor': 2, 'Negligible': 3}
extracted_hazards.sort(key=lambda x: severity_order.get(x['severity'], 4))

# 应用危害类别过滤（如果是详细模式）
if analysis_mode == 'detailed' and available_hazards:
    filtered_hazards = [
        h for h in extracted_hazards 
        if h['hazard'] in available_hazards
    ]
else:
    filtered_hazards = extracted_hazards

# 限制数量（默认前 50 条）
num_hazards = filters.num_hazards if filters else 50
final_hazards = filtered_hazards[:num_hazards]
```

**步骤 8: 保存到数据库**
```python
for idx, hazard in enumerate(final_hazards):
    details_id = generate_id('pha_details')
    
    await conn.execute(
        """INSERT INTO public2.pha_analysis_details 
           (details_id, analysis_id, hazard, potential_harm, severity, 
            hazardous_situation, source, product_code, device_name, 
            created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)""",
        details_id,
        analysis_id,
        hazard['hazard'],
        hazard['potential_harm'],
        hazard['severity'],
        hazard['hazardous_situation'],
        hazard['source_url'],
        hazard['product_code'],
        hazard['device_name'],
        datetime.now(),
        datetime.now()
    )
```

**步骤 9: 更新分析状态为完成**
```python
await conn.execute(
    """UPDATE public2.pha_analysis_versions
       SET status = 'Completed',
           ai_total_records = $1,
           ai_current_count = $2,
           updated_at = $3
       WHERE analysis_id = $4""",
    len(maude_records),
    len(final_hazards),
    datetime.now(),
    analysis_id
)
```

**步骤 10: 发送 WebSocket 通知**
```python
from app.websocket.notify_service import notify_user_via_websocket

await notify_user_via_websocket(
    user_id=user_id,
    notification_type='analysis_completed',
    data={
        'analysis_id': analysis_id,
        'status': 'Completed',
        'hazards_count': len(final_hazards)
    }
)
```

**性能指标**:
- **平均处理时间**: 25-35 秒
- **MAUDE 记录处理**: ~1000 条/次
- **LLM 批处理**: 50 条/批
- **并发任务**: 最多 10 个

---

### 阶段 6: 结果保存与级联更新

#### 6.1 PHA 级联任务 (`/backend/app/tasks/pha_cascading_task.py`)

**触发场景**:
- 用户在前端编辑 PHA 分析结果
- 用户保存修改后的危害信息
- 系统需要同步更新关联的 URRA/FMEA 记录

**任务入口**: `@register_task('save_pha_with_cascading')`

**级联逻辑**:

**步骤 1: 获取旧版本数据**
```python
old_pha_version = await pha_service.get_analysis_version_with_details(analysis_id)
old_pha_details = old_pha_version.details

# 构建旧数据映射（按 source URL）
old_details_by_source = {}
for old_detail in old_pha_details:
    if old_detail.source:
        old_details_by_source[old_detail.source] = old_detail
```

**步骤 2: 选择性更新 PHA 详情**
```python
# 仅更新变化的记录，不是全量替换
changed_details_count = await pha_service.update_analysis_details_selective(
    analysis_id=analysis_id,
    user_id=user_id,
    changed_details=changed_details_list,
    existing_details=old_pha_details,
    deleted_record_ids=deleted_record_ids
)
```

**步骤 3: 识别变化的记录**
```python
# 获取新版本数据
new_pha_version = await pha_service.get_analysis_version_with_details(analysis_id)
new_pha_details = new_pha_version.details

# 比较新旧数据，找出变化的记录
changed_details_ids = set()
for new_detail in new_pha_details:
    old_detail = old_details_by_source.get(new_detail.source)
    
    if not old_detail:
        # 新增记录
        changed_details_ids.add(new_detail.details_id)
    else:
        # 检查字段是否变化
        if (old_detail.hazard != new_detail.hazard or
            old_detail.potential_harm != new_detail.potential_harm or
            old_detail.severity != new_detail.severity):
            changed_details_ids.add(old_detail.details_id)
```

**步骤 4: 查询关联的 URRA 记录**
```python
# 找到所有引用了变化的 PHA 详情的 URRA 记录
urra_records = await conn.fetch(
    """SELECT urra_details_id, analysis_id, use_scenario, 
              hazard, user_edited_fields, pha_details_id
       FROM public2.urra_analysis_details
       WHERE pha_details_id = ANY($1)""",
    list(changed_details_ids)
)

print(f"Found {len(urra_records)} URRA records linked to changed PHA details")
```

**步骤 5: 智能更新 URRA 记录**
```python
for urra_record in urra_records:
    user_edited_fields = urra_record['user_edited_fields'] or {}
    
    # 获取新的 PHA 详情
    pha_detail = new_details_by_id[urra_record['pha_details_id']]
    
    # 只更新未被用户编辑的字段
    update_fields = {}
    
    if 'hazard' not in user_edited_fields:
        update_fields['hazard'] = pha_detail.hazard
    
    if 'potential_harm' not in user_edited_fields:
        update_fields['potential_harm'] = pha_detail.potential_harm
    
    # 如果有字段需要更新
    if update_fields:
        # 使用 LLM 重新生成 use_scenario（基于新的危害信息）
        if 'use_scenario' not in user_edited_fields:
            llm_result = await regenerate_use_scenario_with_llm(
                hazard=update_fields.get('hazard', urra_record['hazard']),
                potential_harm=update_fields.get('potential_harm', urra_record['potential_harm'])
            )
            update_fields['use_scenario'] = llm_result['use_scenario']
        
        # 更新数据库
        await conn.execute(
            """UPDATE public2.urra_analysis_details
               SET hazard = $1, potential_harm = $2, use_scenario = $3,
                   updated_at = $4
               WHERE urra_details_id = $5""",
            update_fields.get('hazard'),
            update_fields.get('potential_harm'),
            update_fields.get('use_scenario'),
            datetime.now(),
            urra_record['urra_details_id']
        )
```

**步骤 6: 查询并更新 FMEA 记录**
```python
# 类似 URRA 的逻辑
fmea_records = await conn.fetch(
    """SELECT fmea_details_id, analysis_id, process_step, 
              failure_mode, user_edited_fields, pha_details_id
       FROM public2.fmea_analysis_details
       WHERE pha_details_id = ANY($1)""",
    list(changed_details_ids)
)

# 智能更新，保留用户编辑
for fmea_record in fmea_records:
    # ... 类似 URRA 的更新逻辑
```

**步骤 7: 记录项目活动**
```python
if not skip_activity_log:
    await conn.execute(
        """INSERT INTO public2.project_activities 
           (activity_id, user_id, team_id, product_id, activity_type,
            description, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
        generate_id('activity'),
        user_id,
        team_id,
        product_id,
        'pha_updated',
        change_description or 'PHA analysis updated',
        json.dumps({
            'analysis_id': analysis_id,
            'changed_count': len(changed_details_ids),
            'urra_updated': len(urra_records),
            'fmea_updated': len(fmea_records)
        }),
        datetime.now()
    )
```

---

### 阶段 7: 轮询与状态更新

#### 7.1 前端轮询 (`/lib/analysis-api.ts`)

**轮询函数**:
```typescript
export async function startAnalysisAndPoll(
  productCodes: string[],
  similarProducts: any[],
  productName: string,
  intendedUse?: string,
  onStatusUpdate?: (status: AnalysisStatusResponse) => void,
  pollInterval: number = 5000,  // 5秒轮询一次
  ...
): Promise<{ analysisId: string }> {
  // 1. 启动分析
  const startResult = await startAnalysis(...)
  const analysisId = startResult.analysis_id
  
  // 2. 轮询状态
  while (true) {
    await sleep(pollInterval)
    
    const status = await getAnalysisStatus(analysisId)
    
    if (onStatusUpdate) {
      onStatusUpdate(status)
    }
    
    // 3. 检查完成状态
    if (status.status === 'Completed') {
      return { analysisId }
    }
    
    if (status.status === 'Failed' || status.status === 'Cancelled') {
      throw new Error(`Analysis ${status.status}: ${status.detail}`)
    }
  }
}
```

**状态 API**: `GET /api/v1/anonclient/analysis-status/{analysis_id}`

**状态响应**:
```json
{
  "analysis_id": "pha_analysis_20260331_abc123",
  "status": "Generating",  // 可能值: Generating, Completed, Failed, Cancelled
  "detail": "Processing MAUDE records: 450/1000",
  "progress": {
    "current": 450,
    "total": 1000,
    "percentage": 45
  },
  "created_at": "2026-03-31T10:30:00Z",
  "updated_at": "2026-03-31T10:30:25Z"
}
```

#### 7.2 WebSocket 实时通知 (`/backend/app/websocket/`)

**连接建立**:
```typescript
// 前端 WebSocket 连接
const ws = new WebSocket(`wss://api.cirahealth.com/ws?token=${firebaseToken}`)

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data)
  
  if (notification.type === 'analysis_completed') {
    // 停止轮询，显示完成消息
    stopPolling()
    showCompletionMessage(notification.data)
  }
  
  if (notification.type === 'task_progress') {
    // 更新进度条
    updateProgressBar(notification.data.progress)
  }
}
```

**后端 WebSocket 服务**:
```python
# app/websocket/router.py
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    # 验证 Firebase token
    user = await verify_firebase_token(token)
    
    # 接受连接
    await websocket.accept()
    
    # 添加到连接管理器
    connection_manager.add_connection(user['uid'], websocket)
    
    try:
        while True:
            # 保持连接活跃
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.remove_connection(user['uid'], websocket)
```

**推送通知**:
```python
# app/websocket/notify_service.py
async def notify_user_via_websocket(
    user_id: str,
    notification_type: str,
    data: dict
):
    message = {
        'type': notification_type,
        'data': data,
        'timestamp': datetime.now().isoformat()
    }
    
    # 发送给用户的所有连接
    await connection_manager.send_to_user(user_id, json.dumps(message))
```

---

### 阶段 8: 结果展示

#### 8.1 报告模态框 (`/components/ReportModal.tsx`)

**组件结构**:
```typescript
interface ReportModalProps {
  productName: string
  intendedUse: string
  hazards: Hazard[]
  analysisId: string
  onClose: () => void
}

function ReportModal({ productName, intendedUse, hazards, analysisId, onClose }: ReportModalProps) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* 标题区 */}
        <div className={styles.header}>
          <h2>PHA Analysis Report</h2>
          <button onClick={onClose}>×</button>
        </div>
        
        {/* 产品信息 */}
        <div className={styles.productInfo}>
          <div><strong>Product:</strong> {productName}</div>
          <div><strong>Intended Use:</strong> {intendedUse}</div>
          <div><strong>Analysis ID:</strong> {analysisId}</div>
          <div><strong>Generated:</strong> {new Date().toLocaleDateString()}</div>
        </div>
        
        {/* 危害表格 */}
        <table className={styles.hazardsTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>Hazard</th>
              <th>Potential Harm</th>
              <th>Severity</th>
              <th>Hazardous Situation</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {hazards.map((hazard, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{hazard.hazard}</td>
                <td>{hazard.potential_harm}</td>
                <td>
                  <span className={`${styles.severity} ${styles[hazard.severity.toLowerCase()]}`}>
                    {hazard.severity}
                  </span>
                </td>
                <td>{hazard.hazardous_situation}</td>
                <td>
                  <a href={hazard.source} target="_blank" rel="noopener noreferrer">
                    MAUDE Report
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* 操作按钮 */}
        <div className={styles.actions}>
          <button onClick={handleExportExcel}>
            Export to Excel
          </button>
          <button onClick={handleExportPDF}>
            Export to PDF
          </button>
          <button onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
```

#### 8.2 导出功能

**Excel 导出** (`/backend/app/utils/excel_export.py`):
```python
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill

def export_pha_to_excel(analysis_id: str, hazards: List[dict]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "PHA Analysis"
    
    # 设置标题行
    headers = ['#', 'Hazard', 'Potential Harm', 'Severity', 
               'Hazardous Situation', 'Source URL']
    ws.append(headers)
    
    # 样式设置
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
    
    # 填充数据
    for idx, hazard in enumerate(hazards, start=1):
        ws.append([
            idx,
            hazard['hazard'],
            hazard['potential_harm'],
            hazard['severity'],
            hazard['hazardous_situation'],
            hazard['source']
        ])
    
    # 调整列宽
    ws.column_dimensions['A'].width = 5
    ws.column_dimensions['B'].width = 30
    ws.column_dimensions['C'].width = 30
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 40
    ws.column_dimensions['F'].width = 50
    
    # 保存到字节流
    from io import BytesIO
    output = BytesIO()
    wb.save(output)
    return output.getvalue()
```

**下载 API**: `GET /api/v1/anonclient/download-report/{analysis_id}`

```python
@router.get("/download-report/{analysis_id}")
async def download_report(
    analysis_id: str,
    format: str = Query('excel', regex='^(excel|pdf)$'),
    uid: str = Depends(get_current_user)
):
    # 获取分析数据
    pha_version = await pha_service.get_analysis_version_with_details(analysis_id)
    
    if format == 'excel':
        file_bytes = export_pha_to_excel(analysis_id, pha_version.details)
        filename = f"PHA_Analysis_{analysis_id}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        file_bytes = export_pha_to_pdf(analysis_id, pha_version)
        filename = f"PHA_Analysis_{analysis_id}.pdf"
        media_type = "application/pdf"
    
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
```

---

## 关键技术实现

### 1. Firebase 认证集成

**前端认证** (`/lib/auth.tsx`):
```typescript
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  
  useEffect(() => {
    const auth = getAuth()
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        setIsAnonymous(firebaseUser.isAnonymous)
      } else {
        // 自动匿名登录
        signInAnonymously(auth)
      }
    })
    
    return () => unsubscribe()
  }, [])
  
  return { user, isAnonymous }
}
```

**后端验证** (`/backend/app/middleware/auth.py`):
```python
from firebase_admin import auth as firebase_auth

async def get_current_user(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = authorization.split('Bearer ')[1]
    
    try:
        # 验证 Firebase ID token
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token['uid']
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### 2. Kafka 消息队列

**连接管理** (`/backend/app/kafka/connection.py`):
```python
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer

class KafkaManager:
    def __init__(self):
        self._producer = None
        self._consumers = {}
    
    async def get_producer(self) -> AIOKafkaProducer:
        if not self._producer:
            self._producer = AIOKafkaProducer(
                bootstrap_servers=settings.kafka_bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                compression_type='gzip',
                acks='all',  # 确保消息持久化
                retries=3
            )
            await self._producer.start()
        return self._producer
    
    async def create_consumer(
        self,
        topic: str,
        group_id: str,
        auto_offset_reset: str = 'earliest'
    ) -> AIOKafkaConsumer:
        consumer = AIOKafkaConsumer(
            topic,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=group_id,
            auto_offset_reset=auto_offset_reset,
            enable_auto_commit=False,  # 手动提交偏移量
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )
        await consumer.start()
        return consumer
```

### 3. OpenAI LLM 集成

**批量提取服务** (`/backend/app/services/maude_llm.py`):
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=settings.openai_api_key)

async def extract_with_llm_batch_async(
    records: List[dict],
    system_prompt: str,
    model: str = 'gpt-4-turbo',
    temperature: float = 0.3
) -> List[dict]:
    """
    批量使用 LLM 提取 MAUDE 记录中的危害信息
    """
    tasks = []
    
    for record in records:
        # 构建用户提示
        user_prompt = f"""
        Device: {record.get('device_name')}
        Product Code: {record.get('product_code')}
        
        Event Description:
        {record.get('event_description', 'N/A')}
        
        Manufacturer Narrative:
        {record.get('manufacturer_narrative', 'N/A')}
        
        Extract: hazard, potential_harm, severity, hazardous_situation
        """
        
        # 创建异步任务
        task = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        tasks.append(task)
    
    # 并发执行所有请求
    responses = await asyncio.gather(*tasks)
    
    # 解析结果
    results = []
    for idx, response in enumerate(responses):
        try:
            content = response.choices[0].message.content
            extracted = json.loads(content)
            
            results.append({
                **extracted,
                'source_url': records[idx].get('source_url'),
                'product_code': records[idx].get('product_code'),
                'device_name': records[idx].get('device_name')
            })
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            results.append(None)
    
    return [r for r in results if r is not None]
```

### 4. 数据库连接池

**连接管理** (`/backend/app/database/connection.py`):
```python
import asyncpg

class Database:
    def __init__(self):
        self._pool = None
    
    async def _get_pool(self) -> asyncpg.Pool:
        if not self._pool:
            self._pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=10,
                max_size=50,
                command_timeout=60,
                server_settings={
                    'application_name': 'cira_health_backend',
                    'jit': 'off'
                }
            )
        return self._pool
    
    async def test_connection(self) -> bool:
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                result = await conn.fetchval('SELECT 1')
                return result == 1
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False
```

---

## 数据库表结构

### 核心表

**1. products** - 产品表
```sql
CREATE TABLE public2.products (
    product_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    team_id VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**2. product_configurations** - 产品配置表
```sql
CREATE TABLE public2.product_configurations (
    config_id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES public2.products(product_id),
    config_number VARCHAR(50) NOT NULL,
    config_description TEXT,
    intended_use TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**3. similar_products** - 相似产品表
```sql
CREATE TABLE public2.similar_products (
    similar_product_id VARCHAR(50) PRIMARY KEY,
    product_code VARCHAR(10) NOT NULL,
    device VARCHAR(255),
    device_class VARCHAR(10),
    regulation_description TEXT,
    medical_specialty VARCHAR(255),
    regulation_number VARCHAR(50),
    classification_link TEXT,
    source VARCHAR(50) DEFAULT 'FDA',
    created_at TIMESTAMP DEFAULT NOW()
);
```

**4. product_similar_products** - 产品-相似产品关联表
```sql
CREATE TABLE public2.product_similar_products (
    product_id VARCHAR(50) REFERENCES public2.products(product_id),
    similar_product_id VARCHAR(50) REFERENCES public2.similar_products(similar_product_id),
    similarity_score FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (product_id, similar_product_id)
);
```

**5. pha_analysis_versions** - PHA 分析版本表
```sql
CREATE TABLE public2.pha_analysis_versions (
    analysis_id VARCHAR(50) PRIMARY KEY,
    config_id VARCHAR(50) REFERENCES public2.product_configurations(config_id),
    version_number VARCHAR(50) NOT NULL,
    version_description TEXT,
    status VARCHAR(20) DEFAULT 'Draft', -- Draft, Generating, Completed, Failed, Cancelled
    ai_total_records INT DEFAULT 0,
    ai_current_count INT DEFAULT 0,
    created_by VARCHAR(100) NOT NULL,
    last_modified_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**6. pha_analysis_details** - PHA 分析详情表
```sql
CREATE TABLE public2.pha_analysis_details (
    details_id VARCHAR(50) PRIMARY KEY,
    analysis_id VARCHAR(50) REFERENCES public2.pha_analysis_versions(analysis_id),
    hazard TEXT NOT NULL,
    potential_harm TEXT,
    severity VARCHAR(20), -- Critical, Major, Minor, Negligible
    hazardous_situation TEXT,
    source TEXT, -- MAUDE report URL
    product_code VARCHAR(10),
    device_name VARCHAR(255),
    user_edited_fields JSONB, -- {"hazard": true, "severity": true}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**7. pha_filters** - PHA 过滤器设置表
```sql
CREATE TABLE public2.pha_filters (
    filter_id VARCHAR(50) PRIMARY KEY,
    analysis_id VARCHAR(50) REFERENCES public2.pha_analysis_versions(analysis_id),
    automatic_settings_enabled BOOLEAN DEFAULT false,
    num_hazards INT DEFAULT 5,
    hazards_mode VARCHAR(20) DEFAULT 'top',
    num_harms INT DEFAULT 5,
    harms_mode VARCHAR(20) DEFAULT 'top',
    num_records_per_pair INT DEFAULT 2,
    records_mode VARCHAR(20) DEFAULT 'top',
    date_range_enabled BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    occurrence_enabled BOOLEAN DEFAULT false,
    min_occurrences INT DEFAULT 1,
    manual_pairs_enabled BOOLEAN DEFAULT false,
    manual_pairs JSONB, -- {"hazards": [...], "harms": [...]}
    urra_descriptions JSONB,
    fmea_descriptions JSONB,
    analysis_mode VARCHAR(20) DEFAULT 'simple', -- simple, detailed
    hazard_categories JSONB, -- ISO 24971 categories
    available_hazards JSONB, -- List of hazards for detailed mode
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**8. celery_tasks** - 任务表
```sql
CREATE TABLE public2.celery_tasks (
    task_id VARCHAR(50) PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    input_data JSONB,
    output_data JSONB,
    progress JSONB, -- {"current": 50, "total": 100, "message": "..."}
    error TEXT,
    analysis_id VARCHAR(50),
    user_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

**9. orders** - 订单表（支付）
```sql
CREATE TABLE public2.orders (
    order_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    product_type VARCHAR(50), -- 'analysis', 'subscription'
    product_id VARCHAR(50), -- analysis_id
    amount DECIMAL(10,2),
    final_amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, completed, cancelled
    payment_intent_id VARCHAR(255), -- Stripe payment_intent_id
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**10. transactions** - 交易表
```sql
CREATE TABLE public2.transactions (
    transaction_id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES public2.orders(order_id),
    payment_intent_id VARCHAR(255),
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20), -- succeeded, failed, pending
    receipt_url TEXT,
    stripe_charge_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 性能优化

### 1. Kafka 消息队列优化
- **分区策略**: 使用 `user_id` 作为分区键，确保同一用户的任务顺序执行
- **批量处理**: 批量提交偏移量，减少网络开销
- **并发控制**: 使用信号量限制最多 10 个并发任务
- **自动重连**: 指数退避重试策略，确保高可用性

### 2. 数据库优化
- **连接池**: 10-50 个连接，复用连接减少开销
- **索引优化**:
  ```sql
  CREATE INDEX idx_pha_analysis_versions_config_id ON public2.pha_analysis_versions(config_id);
  CREATE INDEX idx_pha_analysis_details_analysis_id ON public2.pha_analysis_details(analysis_id);
  CREATE INDEX idx_celery_tasks_analysis_id ON public2.celery_tasks(analysis_id);
  CREATE INDEX idx_orders_user_id ON public2.orders(user_id);
  ```
- **批量插入**: 使用 `COPY` 或批量 `INSERT` 提高写入性能

### 3. LLM 调用优化
- **批量处理**: 每批 50 条记录并发调用 OpenAI API
- **异步执行**: 使用 `asyncio.gather()` 并发执行多个请求
- **温度设置**: `temperature=0.3` 保证输出稳定性
- **结果缓存**: 对相同的 MAUDE 记录缓存 LLM 提取结果

### 4. 前端优化
- **代码分割**: 使用 Next.js 动态导入减少初始加载
- **虚拟滚动**: 大量结果使用虚拟列表渲染
- **轮询优化**: 使用 WebSocket 替代轮询减少请求
- **缓存策略**: 使用 SWR 或 React Query 缓存 API 响应

---

## 监控与日志

### 1. 日志系统

**日志级别**:
```python
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 关键事件日志
logger.info(f"📤 [KAFKA] Task sent - task_id={task_id}, topic={topic}")
logger.info(f"🔔 [KAFKA] Message received - task_id={task_id}")
logger.info(f"⚡ [KAFKA] Executing task - task_id={task_id}")
logger.info(f"✅ [KAFKA] Task completed - task_id={task_id}")
logger.error(f"❌ [KAFKA] Task failed - task_id={task_id}, error={e}")
```

### 2. 性能指标

**关键指标**:
- **任务处理时间**: 平均 25-35 秒
- **MAUDE 记录获取**: 1-5 秒（取决于记录数量）
- **LLM 批量提取**: 15-25 秒（1000 条记录）
- **数据库保存**: 1-3 秒
- **Kafka 延迟**: < 100ms

### 3. 错误处理

**重试机制**:
```python
# Kafka 消费者自动重连
max_retry_delay = 300  # 5 分钟
attempt = 0

while True:
    try:
        await consume_topic(...)
    except Exception as e:
        attempt += 1
        delay = min(5 * (2 ** attempt), max_retry_delay)
        logger.warning(f"Reconnecting in {delay}s...")
        await asyncio.sleep(delay)
```

---

## 安全性

### 1. 认证与授权
- **Firebase Authentication**: 所有 API 请求需要有效的 Firebase ID token
- **团队隔离**: 每个用户只能访问自己团队的数据
- **权限验证**: 在关键操作前验证 `team_id` 匹配

### 2. 数据安全
- **HTTPS**: 所有 API 通信使用 HTTPS 加密
- **SQL 注入防护**: 使用参数化查询
- **XSS 防护**: React 自动转义用户输入
- **CORS**: 限制跨域请求来源

### 3. 支付安全
- **Stripe Integration**: PCI DSS 合规的支付处理
- **Webhook 验证**: 验证 Stripe webhook 签名
- **金额验证**: 后端验证支付金额与订单匹配

---

## 部署架构

### 生产环境

```
[用户浏览器]
    ↓
[Cloudflare CDN] ← 前端静态资源
    ↓
[Next.js 前端] (Vercel/AWS)
    ↓ HTTPS
[API Gateway / Load Balancer]
    ↓
[FastAPI 后端] (多实例)
    ↓
[Kafka Cluster] (3 brokers)
    ↓
[Kafka Workers] (多实例, 每个最多 10 并发)
    ↓
[PostgreSQL] (主从复制)
    ↓
[Redis] (缓存)
```

### 环境变量

**前端** (`.env.local`):
```bash
NEXT_PUBLIC_API_URL=https://api.cirahealth.com
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

**后端** (`.env`):
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
KAFKA_BOOTSTRAP_SERVERS=kafka1:9092,kafka2:9092,kafka3:9092
KAFKA_TOPIC_ANALYZE_MAUDE=analyze-maude-prod
KAFKA_TOPIC_SAVE_PHA=save-pha-with-cascading-prod
OPENAI_API_KEY=sk-...
FIREBASE_CREDENTIALS_JSON=...
STRIPE_SECRET_KEY=sk_live_...
ENVIRONMENT=production
MAX_CONCURRENT_ANALYSES=10
```

---

## 总结

Cira Health 平台通过以下技术实现了高效的医疗器械风险分析：

1. **前后端分离**: Next.js 前端 + FastAPI 后端，独立部署和扩展
2. **异步消息队列**: Kafka 解耦任务提交和执行，支持高并发
3. **AI 驱动分析**: OpenAI GPT-4 自动提取危害信息，减少人工工作量
4. **实时通知**: WebSocket 推送任务进度和完成通知
5. **智能级联更新**: PHA 修改自动同步到 URRA/FMEA，保持数据一致性
6. **FDA 数据集成**: 直接访问 MAUDE、510(k) 等官方数据源
7. **符合监管要求**: 遵循 ISO 14971 和 FDA 指南生成报告

该系统可以在 30 秒内生成符合 FDA 要求的 PHA 报告，显著提高医疗器械制造商的风险分析效率。
