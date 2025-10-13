import { keywordFilter } from './keyword-filter.js';

// 测试 system 字段过滤功能
function testSystemFilter() {
  console.log('🧪 开始测试 system 字段过滤功能...\n');

  // 启用过滤器并加载配置
  keywordFilter.loadConfig('./keywords-filter.json');
  
  if (!keywordFilter.isEnabled()) {
    console.log('❌ 过滤器未启用，请检查配置文件');
    return;
  }

  console.log(`✅ 过滤器已启用，包含 ${keywordFilter.getRuleCount()} 条规则\n`);

  // 测试用例 1: Anthropic 格式的请求
  console.log('📝 测试用例 1: Anthropic 格式请求');
  const anthropicRequest = {
    model: 'claude-3-sonnet-20240229',
    messages: [
      {
        role: 'user',
        content: 'Hello, how are you?'
      }
    ],
    system: [
      {
        type: 'text',
        text: 'You are engineering agent.\n\nYou are software engineering'
      },
      {
        type: 'text',
        text: 'Please help me with coding tasks.'
      }
    ]
  };

  console.log('原始 system 字段:');
  console.log(JSON.stringify(anthropicRequest.system, null, 2));

  // 应用过滤器
  const filteredAnthropicRequest = keywordFilter.filterRequest(anthropicRequest, 'anthropic');

  console.log('\n过滤后的 system 字段:');
  console.log(JSON.stringify(filteredAnthropicRequest.system, null, 2));

  // 测试用例 2: OpenAI 格式的请求（包含 system 消息）
  console.log('\n📝 测试用例 2: OpenAI 格式请求（包含 system 消息）');
  const openaiRequest = {
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are engineering agent. You are software engineering. Droid, an AI software engineering agent built by Factory.'
      },
      {
        role: 'user',
        content: 'Hello, how are you?'
      }
    ]
  };

  console.log('原始 system 消息:');
  console.log(openaiRequest.messages[0].content);

  // 应用过滤器
  const filteredOpenaiRequest = keywordFilter.filterRequest(openaiRequest, 'openai');

  console.log('\n过滤后的 system 消息:');
  console.log(filteredOpenaiRequest.messages[0].content);

  // 显示统计信息
  console.log('\n📊 过滤统计信息:');
  const stats = keywordFilter.getStats();
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n✅ 测试完成！');
}

// 运行测试
testSystemFilter();