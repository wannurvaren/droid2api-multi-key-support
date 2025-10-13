import fs from 'fs';
import path from 'path';
import { logInfo, logDebug, logError, logWarning } from './logger.js';

/**
 * 关键词过滤器类
 * 用于过滤请求中的敏感内容
 */
class KeywordFilter {
  constructor() {
    this.enabled = false;
    this.rules = [];
    this.config = null;
    this.stats = {
      totalFiltered: 0,
      totalMatches: 0,
      ruleMatches: {}
    };
  }

  /**
   * 加载配置文件
   * @param {string} configPath - 配置文件路径
   */
  loadConfig(configPath) {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(configPath)) {
        logInfo('Keyword filter config not found, filter disabled');
        this.enabled = false;
        return;
      }

      // 读取配置文件
      const configContent = fs.readFileSync(configPath, 'utf-8');
      this.config = JSON.parse(configContent);

      // 验证配置
      if (!this.config || typeof this.config !== 'object') {
        throw new Error('Invalid config format');
      }

      // 设置启用状态
      this.enabled = this.config.enabled === true;

      // 加载规则
      if (Array.isArray(this.config.rules)) {
        this.rules = this.config.rules.filter(rule => rule.enabled !== false);
        
        // 初始化统计
        this.rules.forEach(rule => {
          this.stats.ruleMatches[rule.id] = 0;
        });
      }

      if (this.enabled) {
        logInfo(`Keyword filter loaded: ${this.rules.length} active rules`);
        if (this.config.logging?.enabled) {
          logDebug('Keyword filter logging enabled');
        }
      } else {
        logInfo('Keyword filter disabled in config');
      }

    } catch (error) {
      logError('Failed to load keyword filter config', error);
      this.enabled = false;
      this.rules = [];
    }
  }

  /**
   * 检查过滤器是否启用
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * 获取规则数量
   */
  getRuleCount() {
    return this.rules.length;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      enabled: this.enabled,
      ruleCount: this.rules.length,
      totalFiltered: this.stats.totalFiltered,
      totalMatches: this.stats.totalMatches,
      ruleMatches: this.stats.ruleMatches
    };
  }

  /**
   * 过滤请求
   * @param {Object} request - 请求对象
   * @param {string} requestType - 请求类型 ('openai', 'anthropic', 'responses')
   */
  filterRequest(request, requestType) {
    if (!this.enabled || !request) {
      logDebug(`Filter not applied - enabled: ${this.enabled}, request exists: ${!!request}`);
      return request;
    }

    try {
      logDebug(`Starting filter for request type: ${requestType}`);
      
      // 根据请求类型提取 messages
      let messages;
      if (requestType === 'openai' || requestType === 'anthropic') {
        messages = request.messages;
      } else if (requestType === 'responses') {
        messages = request.input;
      }

      if (!messages || !Array.isArray(messages)) {
        logDebug(`No messages found or not array - messages: ${messages}`);
        return request;
      }

      logDebug(`Processing ${messages.length} messages with ${this.rules.length} active rules`);
      
      // 过滤消息
      this.filterMessages(messages);
      
      logDebug(`Filter processing completed`);

    } catch (error) {
      logError('Error filtering request', error);
    }

    // 处理 system 字段（主要用于 Anthropic 格式）
    if (request.system && Array.isArray(request.system)) {
      logDebug(`Processing system field with ${request.system.length} items`);
      this.filterSystemField(request.system);
    }

    return request;
  }

  /**
   * 过滤消息数组
   * @param {Array} messages - 消息数组
   */
  filterMessages(messages) {
    if (!Array.isArray(messages)) {
      return;
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      logDebug(`Processing message ${i + 1}/${messages.length} - role: ${message.role}`);
      
      // 只处理用户消息
      if (message.role !== 'user') {
        logDebug(`Skipping non-user message (role: ${message.role})`);
        continue;
      }

      // 处理 content
      if (typeof message.content === 'string') {
        // 字符串类型 content
        logDebug(`Message content is string, length: ${message.content.length}`);
        logDebug(`Content preview: ${message.content.substring(0, 100)}...`);
        const result = this.applyRulesToText(message.content, null);
        if (result.action === 'replace') {
          logDebug(`Content replaced by rule: ${result.ruleId}`);
          message.content = result.text;
          this.stats.totalFiltered++;
        } else {
          logDebug(`No replacement needed`);
        }
      } else if (Array.isArray(message.content)) {
        // 数组类型 content
        logDebug(`Message content is array, length: ${message.content.length}`);
        message.content = this.filterContentArray(message.content);
      } else {
        logDebug(`Message content type: ${typeof message.content}`);
      }
    }
  }

  /**
   * 过滤 content 数组
   * @param {Array} contentArray - content 数组
   * @returns {Array} 过滤后的 content 数组
   */
  filterContentArray(contentArray) {
    const filtered = [];

    for (const item of contentArray) {
      // 只处理文本类型
      const isTextType = item.type === 'text' ||
                        item.type === 'input_text' ||
                        item.type === 'output_text';

      if (!isTextType || !item.text) {
        filtered.push(item);
        continue;
      }

      // 应用规则
      const result = this.applyRulesToText(item.text, item);

      if (result.action === 'remove') {
        // 删除整个 content 块
        this.stats.totalFiltered++;
        if (this.shouldLog('logActions')) {
          logDebug(`Removed content block due to rule: ${result.ruleId}`);
        }
        continue; // 跳过此项，不添加到结果中
      } else if (result.action === 'replace') {
        // 替换文本
        filtered.push({ ...item, text: result.text });
        this.stats.totalFiltered++;
        if (this.shouldLog('logActions')) {
          logDebug(`Replaced text due to rule: ${result.ruleId}`);
        }
      } else {
        // 保持不变
        filtered.push(item);
      }
    }

    return filtered;
  }

  /**
   * 过滤 system 字段
   * @param {Array} systemArray - system 数组
   */
  filterSystemField(systemArray) {
    if (!Array.isArray(systemArray)) {
      return;
    }

    logDebug(`Processing system field with ${systemArray.length} items`);

    for (let i = 0; i < systemArray.length; i++) {
      const item = systemArray[i];
      logDebug(`Processing system item ${i + 1}/${systemArray.length} - type: ${item.type}`);
      
      // 只处理文本类型
      if (item.type === 'text' && item.text) {
        logDebug(`System item text length: ${item.text.length}`);
        logDebug(`System item text preview: ${item.text.substring(0, 100)}...`);
        
        const result = this.applyRulesToText(item.text, item);
        if (result.action === 'replace') {
          logDebug(`System text replaced by rule: ${result.ruleId}`);
          systemArray[i].text = result.text;
          this.stats.totalFiltered++;
        } else if (result.action === 'remove') {
          logDebug(`System item removed by rule: ${result.ruleId}`);
          systemArray.splice(i, 1);
          i--; // 调整索引
          this.stats.totalFiltered++;
        } else {
          logDebug(`No replacement needed for system item`);
        }
      } else {
        logDebug(`System item type: ${item.type}, skipping`);
      }
    }

    logDebug(`System field filtering completed. Remaining items: ${systemArray.length}`);
  }

  /**
   * 对文本应用所有规则
   * @param {string} text - 要检查的文本
   * @param {Object} contentItem - content 对象（用于 remove_content 动作）
   * @returns {Object} 处理结果
   */
  applyRulesToText(text, contentItem) {
    logDebug(`Checking text against ${this.rules.length} rules`);
    
    for (const rule of this.rules) {
      if (!rule.enabled) {
        logDebug(`Skipping disabled rule: ${rule.id}`);
        continue;
      }

      logDebug(`Testing rule: ${rule.id} (${rule.name})`);
      logDebug(`  Pattern type: ${rule.pattern.type}, value: ${rule.pattern.value}`);
      
      // 检查是否匹配
      const matched = this.matchPattern(text, rule.pattern);
      
      if (matched) {
        // 记录匹配
        this.stats.totalMatches++;
        this.stats.ruleMatches[rule.id] = (this.stats.ruleMatches[rule.id] || 0) + 1;

        logDebug(`✓ Rule MATCHED: ${rule.id} (${rule.name})`);
        if (this.shouldLog('logMatches')) {
          logDebug(`Rule matched: ${rule.id} (${rule.name})`);
        }

        // 执行动作
        return this.executeAction(text, rule);
      } else {
        logDebug(`✗ Rule NOT matched: ${rule.id}`);
      }
    }

    // 没有匹配的规则，保持原样
    logDebug(`No rules matched, keeping original text`);
    return { action: 'keep', text };
  }

  /**
   * 匹配模式
   * @param {string} text - 要检查的文本
   * @param {Object} pattern - 匹配模式
   * @returns {boolean} 是否匹配
   */
  matchPattern(text, pattern) {
    if (!text || !pattern || !pattern.value) {
      return false;
    }

    let checkText = text;
    let checkValue = pattern.value;

    // 处理大小写
    if (!pattern.caseSensitive) {
      checkText = text.toLowerCase();
      checkValue = pattern.value.toLowerCase();
    }

    // 根据类型进行匹配
    switch (pattern.type) {
      case 'contains':
        return checkText.includes(checkValue);
      
      case 'prefix':
        return checkText.startsWith(checkValue);
      
      case 'suffix':
        return checkText.endsWith(checkValue);
      
      case 'regex':
        try {
          const flags = pattern.caseSensitive ? '' : 'i';
          const regex = new RegExp(pattern.value, flags);
          return regex.test(text);
        } catch (error) {
          logError(`Invalid regex pattern in rule: ${pattern.value}`, error);
          return false;
        }
      
      default:
        logWarning(`Unknown pattern type: ${pattern.type}`);
        return false;
    }
  }

  /**
   * 执行动作
   * @param {string} text - 原始文本
   * @param {Object} rule - 规则对象
   * @returns {Object} 处理结果
   */
  executeAction(text, rule) {
    const action = rule.action;

    switch (action.type) {
      case 'remove_content':
        // 删除整个 content 块
        return { action: 'remove', ruleId: rule.id };
      
      case 'replace':
        // 替换关键词
        const replacement = action.replacement || '';
        let newText = text;
        
        if (rule.pattern.type === 'regex') {
          const flags = rule.pattern.caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(rule.pattern.value, flags);
          newText = text.replace(regex, replacement);
        } else {
          // 简单替换（支持大小写不敏感）
          const searchValue = rule.pattern.value;
          if (rule.pattern.caseSensitive) {
            newText = text.split(searchValue).join(replacement);
          } else {
            const regex = new RegExp(this.escapeRegex(searchValue), 'gi');
            newText = text.replace(regex, replacement);
          }
        }
        
        return { action: 'replace', text: newText, ruleId: rule.id };
      
      case 'delete_keyword':
        // 删除关键词本身
        let resultText = text;
        const keyword = rule.pattern.value;
        
        if (rule.pattern.type === 'regex') {
          const flags = rule.pattern.caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(rule.pattern.value, flags);
          resultText = text.replace(regex, '');
        } else if (rule.pattern.type === 'prefix') {
          if (rule.pattern.caseSensitive) {
            if (text.startsWith(keyword)) {
              resultText = text.slice(keyword.length);
            }
          } else {
            if (text.toLowerCase().startsWith(keyword.toLowerCase())) {
              resultText = text.slice(keyword.length);
            }
          }
        } else if (rule.pattern.type === 'suffix') {
          if (rule.pattern.caseSensitive) {
            if (text.endsWith(keyword)) {
              resultText = text.slice(0, -keyword.length);
            }
          } else {
            if (text.toLowerCase().endsWith(keyword.toLowerCase())) {
              resultText = text.slice(0, -keyword.length);
            }
          }
        } else {
          // contains 类型：删除所有出现
          if (rule.pattern.caseSensitive) {
            resultText = text.split(keyword).join('');
          } else {
            const regex = new RegExp(this.escapeRegex(keyword), 'gi');
            resultText = text.replace(regex, '');
          }
        }
        
        return { action: 'replace', text: resultText, ruleId: rule.id };
      
      default:
        logWarning(`Unknown action type: ${action.type}`);
        return { action: 'keep', text };
    }
  }

  /**
   * 转义正则表达式特殊字符
   * @param {string} str - 要转义的字符串
   * @returns {string} 转义后的字符串
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 检查是否应该记录日志
   * @param {string} logType - 日志类型
   * @returns {boolean}
   */
  shouldLog(logType) {
    return this.config?.logging?.enabled && this.config?.logging?.[logType];
  }
}

// 创建并导出单例
export const keywordFilter = new KeywordFilter();