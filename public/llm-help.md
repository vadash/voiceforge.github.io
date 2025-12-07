# Free LLM Options for Voice Assignment

This app uses an OpenAI-compatible API for character detection and voice assignment. Here are free options:

## [LongCat]

API URL: `https://api.longcat.chat/openai/v1`

Model Name: `LongCat-Flash-Thinking`

Reasoning: `high`

## [iFlow.cn]

API URL: `https://apis.iflow.cn/v1`

Model Name: `qwen3-coder-plus` or `kimi-k2-0905`

Reasoning: `high`

---

There are many sources offering free credits or inference. Note that nearly all of these have some level of rate limiting. Effectively every provider that offers free inference is doing it because they train on your data - be aware.

- OpenRouter Free Models:
  - https://openrouter.ai/models?max_price=0
  - By default, you get 50 free model requests per day from a pretty huge variety.
  - If you _top up **once** with them_ for $10, they permanently increase your limit to 1000 requests per day. A very solid offering.

- Nvidia NIM: Check out Nvidia's Inference Microservices for potential free tiers.
  - Link: https://build.nvidia.com/explore/discover
  - A pretty solid free tier with ~40 requests per minute to some very good models.

- [Mistral (La Plateforme)](https://console.mistral.ai/): Experiment plan grants free access if you opt into training and complete phone verification.
  - Limits (per model family): 1 request/second, 500,000 tokens/minute, 1,000,000,000 tokens/month.
  - Reference model catalog: https://docs.mistral.ai/getting-started/models/models_overview/

- [Mistral (Codestral)](https://codestral.mistral.ai/): Hosted coding-centric workspace that currently waives usage fees.
  - Requires a monthly subscription setup, but the plan is presently $0 after phone verification.
  - Limits: 30 requests/minute, 2,000 requests/day across supported tooling flows.

- [Groq](https://console.groq.com): Token streaming hardware gives fast latencies alongside model-dependent rate caps.
  - Quotas range from 250 to 14,400 requests/day and 6,000 to 70,000 tokens/minute depending on the model family and modality.
  - Their dashboard surfaces current free allocations and any temporary throttles.

- [iFlow.cn](https://iflow.cn): A number of popular open weight models including GLM 4.5 and Qwen3-Coder.  The site is Chinese only, but to register go to : https://iflow.cn/ log with a Google account, generate/copy an API key; then doc is easy: https://platform.iflow.cn/en/docs.  API baseURL is https://apis.iflow.cn/v1 as url and API key.  Model list at https://platform.iflow.cn/en/models.

- [LongCat](https://longcat.chat/platform): [LongCat Flash](https://huggingface.co/meituan-longcat/LongCat-Flash-Chat) (and its thinking variant).  Supports both `/chat/completions` and `messages` (Anthropic) format.  A baseline 500,000 tokens perday, but with a quick form fill, 5M tokens.

- [Ollama Cloud](https://docs.ollama.com/cloud): Supports both OpenAI and Ollama compatible endpoints, with a number of quality models, including deepseek-v3.1:671b-cloud, gpt-oss:20b-cloud, gpt-oss:120b-cloud, kimi-k2:1t-cloud, qwen3-coder:480b-cloud, glm-4.6:cloud, minimax-m2:cloud.   Limits are not clearly documented, beyond "Ollama's cloud includes hourly and daily limits to avoid capacity issues".  However, brief testing suggests the weekly limit is approx 5M tokens, and the hourly limit is about 165,000 tokens.
