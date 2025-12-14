// src/services/openaiService.js
class OpenAIService {
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    this.baseURL = 'https://api.openai.com/v1';
  }

  /**
   * Check if API key is configured
   */
  isConfigured() {
    return !!this.apiKey && this.apiKey !== 'your-api-key-here';
  }

  /**
   * Make a request to OpenAI API
   */
  async makeRequest(endpoint, data) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key is not configured');
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw error;
    }
  }

  /**
   * Generate business insights from client analytics data
   */
  async generateClientInsights(clientData) {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const prompt = `You are a business analytics expert for a salon management system. Analyze the following client data and provide actionable insights:

Total Clients: ${clientData.totalClients}
Total Revenue: ₱${clientData.totalRevenue.toLocaleString()}
Total Visits: ${clientData.totalVisits}
Average Spending: ₱${clientData.avgSpending.toLocaleString()}
Average Visits: ${clientData.avgVisits.toFixed(1)}

Top Spending Clients: ${clientData.topSpenders?.slice(0, 5).map(c => `${c.name}: ₱${c.totalSpending.toLocaleString()}`).join(', ') || 'N/A'}

Provide:
1. Key insights (2-3 bullet points)
2. Recommendations for improving customer retention
3. Opportunities for revenue growth

Format as JSON with keys: insights, recommendations, opportunities. Keep each section concise (2-3 items max).`;

      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a business analytics expert. Provide concise, actionable insights in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      // Try to parse JSON from the response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // If JSON parsing fails, return formatted text
        return {
          insights: [content.split('\n').filter(line => line.trim()).slice(0, 3)],
          recommendations: [],
          opportunities: []
        };
      }
    } catch (error) {
      console.error('Error generating client insights:', error);
      return null;
    }
  }

  /**
   * Generate product sales insights
   */
  async generateProductSalesInsights(salesData) {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const topProducts = salesData.slice(0, 10).map(p => ({
        name: p.productName,
        revenue: p.totalRevenue,
        quantity: p.totalQuantity
      }));

      const prompt = `You are a business analytics expert for a salon. Analyze these product sales data:

Top Products:
${topProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.quantity} units, ₱${p.revenue.toLocaleString()} revenue`).join('\n')}

Total Products: ${salesData.length}
Total Revenue: ₱${salesData.reduce((sum, p) => sum + p.totalRevenue, 0).toLocaleString()}

Provide:
1. Key insights about product performance (2-3 points)
2. Recommendations for inventory management
3. Opportunities for product promotion

Format as JSON with keys: insights, recommendations, opportunities. Keep concise (2-3 items per section).`;

      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a business analytics expert. Provide concise, actionable insights in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        return {
          insights: [content.split('\n').filter(line => line.trim()).slice(0, 3)],
          recommendations: [],
          opportunities: []
        };
      }
    } catch (error) {
      console.error('Error generating product sales insights:', error);
      return null;
    }
  }

  /**
   * Generate promotion recommendations
   */
  async generatePromotionRecommendations(clientData, salesData) {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const prompt = `You are a marketing expert for a salon. Based on this data, suggest promotion strategies:

Client Metrics:
- Average spending: ₱${clientData.avgSpending?.toLocaleString() || '0'}
- Average visits: ${clientData.avgVisits?.toFixed(1) || '0'}
- Total clients: ${clientData.totalClients || 0}

Product Performance:
- Top products: ${salesData?.slice(0, 5).map(p => p.productName).join(', ') || 'N/A'}

Provide:
1. Promotion ideas (2-3 specific suggestions)
2. Target audience recommendations
3. Optimal discount strategies

Format as JSON with keys: promotions, targetAudience, discountStrategy. Keep concise.`;

      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a marketing expert. Provide specific, actionable promotion recommendations in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        return {
          promotions: [content.split('\n').filter(line => line.trim()).slice(0, 3)],
          targetAudience: [],
          discountStrategy: []
        };
      }
    } catch (error) {
      console.error('Error generating promotion recommendations:', error);
      return null;
    }
  }

  /**
   * Generate individual client insights
   */
  async generateClientRecommendations(client) {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const prompt = `You are a customer relationship expert. Analyze this client's data:

Client: ${client.clientName}
Total Spending: ₱${client.totalSpending.toLocaleString()}
Total Visits: ${client.visitCount}
Average Transaction: ₱${client.avgTransactionValue.toLocaleString()}
Days Since Last Visit: ${client.daysSinceLastVisit}
Top Services: ${client.topServices?.map(s => s.name).join(', ') || 'None'}
Top Products: ${client.topProducts?.map(p => p.name).join(', ') || 'None'}

Provide:
1. Client value assessment (VIP, Regular, At-Risk)
2. Personalized recommendations (2-3 specific suggestions)
3. Re-engagement strategies if needed

Format as JSON with keys: valueAssessment, recommendations, reEngagement. Keep concise.`;

      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a customer relationship expert. Provide personalized client insights in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 400
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        return {
          valueAssessment: 'Regular',
          recommendations: [content.split('\n').filter(line => line.trim()).slice(0, 2)],
          reEngagement: []
        };
      }
    } catch (error) {
      console.error('Error generating client recommendations:', error);
      return null;
    }
  }
}

export const openaiService = new OpenAIService();

